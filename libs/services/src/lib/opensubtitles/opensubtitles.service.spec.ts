import { TestBed } from '@angular/core/testing';
import {
    DEFAULT_OPEN_SUBTITLES_SETTINGS,
    type OpenSubtitlesSettings,
} from '@iptvnator/shared/interfaces';
import { SettingsStore } from '../settings-store.service';
import { OPEN_SUBTITLES_TRANSPORT } from './opensubtitles-api';
import { OpenSubtitlesError } from './opensubtitles-error';
import type { SubtitleLookup } from './opensubtitles-match';
import { OpenSubtitlesService } from './opensubtitles.service';
import {
    FAKE_KEY,
    FAKE_PASSWORD,
    FAKE_TOKEN,
    FAKE_USER,
    FakeOpenSubtitlesApi,
    result,
} from './opensubtitles.test-helpers';
import { SubtitleCache } from './subtitle-cache';

const MOVIE: SubtitleLookup = {
    kind: 'movie',
    title: 'Death Inc.',
    year: 2024,
    tmdbId: 1001,
};
const MOVIE_QUERY = 'languages=ea%2Ces%2Csp&tmdb_id=1001&type=movie';

describe('OpenSubtitlesService (fake API)', () => {
    let api: FakeOpenSubtitlesApi;
    let account: OpenSubtitlesSettings;
    let transport: typeof api.transport | null;

    function create(): OpenSubtitlesService {
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: OPEN_SUBTITLES_TRANSPORT,
                    useFactory: () => transport,
                },
                {
                    provide: SettingsStore,
                    useValue: { openSubtitles: () => account },
                },
            ],
        });
        return TestBed.inject(OpenSubtitlesService);
    }

    beforeEach(() => {
        api = new FakeOpenSubtitlesApi();
        transport = api.transport;
        account = {
            ...DEFAULT_OPEN_SUBTITLES_SETTINGS,
            apiKey: FAKE_KEY,
            username: FAKE_USER,
            password: FAKE_PASSWORD,
        };
        api.results.set(MOVIE_QUERY, [
            result(11, { download_count: 5000, machine_translated: true }),
            result(12, { download_count: 300 }),
            result(13, { download_count: 900, hearing_impaired: true }),
            result(14, { download_count: 9000, language: 'fr' }),
        ]);
    });

    it('searches, picks the best match, downloads, converts to WebVTT and caches it', async () => {
        const service = create();

        const found = await service.find(MOVIE);

        expect(api.operations()).toEqual([
            'search',
            'login',
            'download',
            'file',
        ]);
        expect(api.requests[0].query).toEqual({
            languages: 'ea,es,sp',
            tmdb_id: '1001',
            type: 'movie',
        });
        // A human translation, not for the hearing impaired, beats a more
        // downloaded machine one.
        expect(api.requests[2].body).toEqual({ file_id: 12 });
        expect(api.requests[2].token).toBe(FAKE_TOKEN);
        expect(found).toEqual(
            expect.objectContaining({
                language: 'es',
                name: 'Release 12',
                fromCache: false,
            })
        );
        expect(found.content).toMatch(/^WEBVTT\n\n/);
        expect(found.content).toContain('00:00:01.000 --> 00:00:03.500');
        expect(found.content).toContain('¿Dónde estabas?');
        expect(found.content).not.toContain('{\\an8}');
        expect(service.remainingDownloads()).toBe(19);
        expect(service.lastError()).toBeNull();
    });

    it('serves a title watched again from the cache, costing no download', async () => {
        const service = create();
        await service.find(MOVIE);
        api.requests.length = 0;

        const again = await service.find(MOVIE);

        expect(again.fromCache).toBe(true);
        expect(api.requests).toEqual([]);
        expect(api.remaining).toBe(19);
        expect(
            await TestBed.inject(SubtitleCache).get('movie:tmdb:1001:es')
        ).toEqual(expect.objectContaining({ language: 'es' }));
    });

    it('falls back to the name and year, then to the second language', async () => {
        account = { ...account, language: 'en', secondLanguage: 'es' };
        api.results.clear();
        api.results.set(
            'languages=ea%2Ces%2Csp&query=death+inc.&type=movie&year=2024',
            [result(21)]
        );
        const service = create();

        const found = await service.find(MOVIE);

        expect(found.language).toBe('es');
        expect(
            api.requests
                .filter((request) => request.operation === 'search')
                .map((request) => request.query)
        ).toEqual([
            { languages: 'en', tmdb_id: '1001', type: 'movie' },
            {
                languages: 'en',
                query: 'death inc.',
                type: 'movie',
                year: '2024',
            },
            { languages: 'ea,es,sp', tmdb_id: '1001', type: 'movie' },
            {
                languages: 'ea,es,sp',
                query: 'death inc.',
                type: 'movie',
                year: '2024',
            },
        ]);
        expect(
            api.requests.find((r) => r.operation === 'download')?.body
        ).toEqual({
            file_id: 21,
        });
    });

    it('looks an episode up by its series, season and number', async () => {
        api.results.set(
            'episode_number=3&languages=ea%2Ces%2Csp&parent_tmdb_id=77&season_number=2&type=episode',
            [
                result(31, {
                    download_count: 9999,
                    feature_details: { season_number: 2, episode_number: 4 },
                }),
                result(32, {
                    feature_details: { season_number: 2, episode_number: 3 },
                }),
            ]
        );
        const service = create();

        await service.find({
            kind: 'episode',
            title: 'Muertos S.L.',
            tmdbId: 77,
            season: 2,
            episode: 3,
        });

        expect(
            api.requests.find((r) => r.operation === 'download')?.body
        ).toEqual({
            file_id: 32,
        });
    });

    it('signs in again once when the token expired', async () => {
        api.expiredTokens = 1;
        const service = create();
        await service.find(MOVIE);

        expect(api.operations().filter((op) => op === 'login')).toHaveLength(2);
        expect(api.operations().filter((op) => op === 'download')).toHaveLength(
            2
        );
    });

    it('reports the used-up daily quota with its reset time', async () => {
        api.remaining = 0;
        const service = create();

        const failure = await service.find(MOVIE).catch((error) => error);

        expect(failure).toBeInstanceOf(OpenSubtitlesError);
        expect(failure).toEqual(
            expect.objectContaining({
                kind: 'quota',
                resetAt: '2026-10-25T13:05:00.000Z',
            })
        );
        expect(service.lastError()).toBe('quota');
    });

    it('reports a wrong login, a refused key, nothing found, no key and no bridge', async () => {
        const kindOf = (promise: Promise<unknown>) =>
            promise.then(
                () => 'ok',
                (error: OpenSubtitlesError) => error.kind
            );

        account = { ...account, password: 'wrong' };
        expect(await kindOf(create().find(MOVIE))).toBe('login-failed');

        TestBed.resetTestingModule();
        account = { ...account, password: FAKE_PASSWORD, apiKey: 'other-key' };
        expect(await kindOf(create().find(MOVIE))).toBe('invalid-key');

        TestBed.resetTestingModule();
        account = { ...account, apiKey: FAKE_KEY };
        api.results.clear();
        expect(await kindOf(create().find(MOVIE))).toBe('not-found');

        TestBed.resetTestingModule();
        account = { ...account, apiKey: '' };
        expect(await kindOf(create().find(MOVIE))).toBe('no-key');

        TestBed.resetTestingModule();
        account = { ...account, apiKey: FAKE_KEY };
        transport = null;
        const service = create();
        expect(service.availability()).toBe('unavailable');
        expect(await kindOf(service.find(MOVIE))).toBe('unavailable');
    });

    it('checks an account from Settings and reports the downloads left', async () => {
        const service = create();

        await expect(service.testAccount(account)).resolves.toEqual({
            remaining: 20,
            allowed: 20,
        });
        await expect(
            service.testAccount({ ...account, password: 'nope' })
        ).rejects.toEqual(expect.objectContaining({ kind: 'login-failed' }));
    });

    it('never writes the key, the account or the token to the console', async () => {
        const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
            (method) => jest.spyOn(console, method).mockImplementation()
        );
        const service = create();
        await service.find(MOVIE);
        api.remaining = 0;
        const failures = await Promise.all([
            service.find({ ...MOVIE, tmdbId: 1002 }).catch((error) => error),
            service
                .testAccount({ ...account, password: 'nope' })
                .catch((error) => error),
        ]);
        const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
        const messages = failures.map((error) => String(error?.message));

        for (const secret of [FAKE_KEY, FAKE_PASSWORD, FAKE_TOKEN, FAKE_USER]) {
            expect(logged).not.toContain(secret);
            for (const message of messages) {
                expect(message).not.toContain(secret);
            }
        }
        spies.forEach((spy) => spy.mockRestore());
    });
});
