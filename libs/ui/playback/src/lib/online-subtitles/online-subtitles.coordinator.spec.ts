import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import {
    LazySnackBar,
    OpenSubtitlesError,
    OpenSubtitlesService,
    SettingsStore,
    TitlePlatformStore,
} from '@iptvnator/services';
import {
    DEFAULT_OPEN_SUBTITLES_SETTINGS,
    type ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { createEmptyControlsState } from '../player-controls/player-controls-defaults';
import type {
    PlayerController,
    PlayerControlsState,
    PlayerTrack,
} from '../player-controls/player-controls.model';
import { onlineSubtitleSearch, registerActivePlayer } from './active-player';
import {
    AUTO_SEARCH_DELAY_MS,
    OnlineSubtitlesCoordinator,
} from './online-subtitles.coordinator';

const PLAYBACK: ResolvedPortalPlayback = {
    streamUrl: 'http://provider.invalid/movie/13.mkv',
    title: 'Death Inc.',
    contentInfo: { playlistId: 'p1', contentXtreamId: 13, contentType: 'vod' },
};
const VTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola\n';

describe('OnlineSubtitlesCoordinator', () => {
    let now: number;
    let state: ReturnType<typeof signal<PlayerControlsState>>;
    let attach: jest.Mock;
    let canAttach: boolean;
    let find: jest.Mock;
    let account: typeof DEFAULT_OPEN_SUBTITLES_SETTINGS;
    let toast: jest.Mock;
    let release: (() => void) | null;
    let coordinator: OnlineSubtitlesCoordinator;

    function player(extra: Partial<PlayerController> = {}): PlayerController {
        return {
            capabilities: signal({}) as never,
            state,
            commands: {
                setAudioTrack: jest.fn(),
                setSubtitleTrack: jest.fn(),
            } as never,
            subtitleAttachment: { canAttach: () => canAttach, attach },
            ...extra,
        };
    }

    function setState(patch: Partial<PlayerControlsState>): void {
        state.set({ ...state(), ...patch });
        TestBed.tick();
    }

    async function playPastDelay(): Promise<void> {
        setState({ status: 'playing', positionSeconds: 0 });
        now += AUTO_SEARCH_DELAY_MS + 1;
        setState({ positionSeconds: 4 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    beforeEach(() => {
        now = 1_000_000;
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        state = signal(createEmptyControlsState());
        attach = jest.fn().mockResolvedValue(true);
        canAttach = true;
        account = { ...DEFAULT_OPEN_SUBTITLES_SETTINGS, apiKey: 'k' };
        find = jest.fn().mockResolvedValue({
            name: 'Release',
            language: 'ea',
            content: VTT,
            fromCache: false,
        });
        toast = jest.fn().mockResolvedValue(null);
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                {
                    provide: SettingsStore,
                    useValue: { audioLanguage: signal('original') },
                },
                { provide: LazySnackBar, useValue: { open: toast } },
                {
                    provide: OpenSubtitlesService,
                    useValue: {
                        availability: () =>
                            account.apiKey ? 'ready' : 'no-key',
                        account: () => account,
                        languages: () =>
                            [account.language, account.secondLanguage].filter(
                                Boolean
                            ),
                        find,
                    },
                },
            ],
        });
        TestBed.inject(TitlePlatformStore).show({
            playlistId: 'p1',
            kind: 'movie',
            itemId: 13,
            lookup: { name: 'Death Inc.', year: 2024, tmdbId: 1001 },
        });
        coordinator = TestBed.inject(OnlineSubtitlesCoordinator);
        coordinator.follow(signal(PLAYBACK));
        release = registerActivePlayer(player());
    });

    afterEach(() => {
        release?.();
        jest.restoreAllMocks();
    });

    it('downloads and attaches a Spanish subtitle once when the file has none', async () => {
        await playPastDelay();
        setState({ positionSeconds: 9 });

        expect(find).toHaveBeenCalledTimes(1);
        expect(find).toHaveBeenCalledWith({
            kind: 'movie',
            title: 'Death Inc.',
            year: 2024,
            tmdbId: 1001,
            imdbId: null,
        });
        expect(attach).toHaveBeenCalledWith({
            name: 'OPEN_SUBTITLES.TRACK_LABEL',
            format: 'vtt',
            content: VTT,
            language: 'es',
        });
        expect(toast).toHaveBeenLastCalledWith(
            'OPEN_SUBTITLES.ATTACHED',
            undefined,
            expect.objectContaining({ duration: expect.any(Number) })
        );
    });

    it('waits for the embedded tracks before searching', async () => {
        setState({ status: 'playing' });
        now += AUTO_SEARCH_DELAY_MS - 500;
        setState({ positionSeconds: 2 });

        expect(find).not.toHaveBeenCalled();
    });

    it('does not search when the file has Spanish subtitles or Spanish audio', async () => {
        const spanish: PlayerTrack = {
            id: 1,
            label: 'Español',
            selected: false,
        };
        setState({ subtitleTracks: [spanish] });
        await playPastDelay();
        expect(find).not.toHaveBeenCalled();

        release?.();
        state = signal({
            ...createEmptyControlsState(),
            audioTracks: [{ id: 1, label: 'Castellano', selected: true }],
        });
        release = registerActivePlayer(player());
        await playPastDelay();
        expect(find).not.toHaveBeenCalled();
    });

    it('spends no download when the player cannot show it (older installer)', async () => {
        canAttach = false;

        await playPastDelay();

        expect(find).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(
            'OPEN_SUBTITLES.NEEDS_UPDATE',
            undefined,
            expect.anything()
        );
    });

    it("says when the day's quota is used up", async () => {
        find.mockRejectedValue(
            new OpenSubtitlesError('quota', '2026-10-25T13:05:00.000Z')
        );

        await playPastDelay();

        expect(attach).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(
            'OPEN_SUBTITLES.QUOTA',
            undefined,
            expect.anything()
        );
    });

    it('stays quiet when nothing is found by itself, answers when asked', async () => {
        find.mockRejectedValue(new OpenSubtitlesError('not-found'));

        await playPastDelay();
        expect(toast).not.toHaveBeenCalled();

        expect(onlineSubtitleSearch()?.canSearch()).toBe(false); // PWA: no bridge
        coordinator.searchNow();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(find).toHaveBeenCalledTimes(2);
        expect(toast).toHaveBeenLastCalledWith(
            'OPEN_SUBTITLES.NOT_FOUND',
            undefined,
            expect.anything()
        );
    });

    it('only searches when asked with "Search automatically" off', async () => {
        account = { ...account, autoSearch: false };

        await playPastDelay();
        expect(find).not.toHaveBeenCalled();

        coordinator.searchNow();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(attach).toHaveBeenCalledTimes(1);
    });
});
