import { OPENSUBTITLES_REQUEST } from '@iptvnator/shared/interfaces';

const mockHandle = jest.fn();
const mockNetFetch = jest.fn();
jest.mock('electron', () => ({
    app: { getVersion: () => '0.2.5' },
    ipcMain: { handle: mockHandle },
    net: { fetch: mockNetFetch },
}));

import {
    MAX_SUBTITLE_BYTES,
    registerOpenSubtitlesHandlers,
    runOpenSubtitlesRequest,
    toOpenSubtitlesHttpRequest,
} from './opensubtitles.events';

const KEY = 'fake-api-key';
const PASSWORD = 'fake-secret-pass';
const TOKEN = 'fake-token';

function response(
    body: string,
    status = 200,
    headers: Record<string, string> = {}
) {
    return new Response(body, { status, headers });
}

describe('OpenSubtitles main-process bridge', () => {
    afterEach(() => jest.clearAllMocks());

    it('signs in with the key, the app as User-Agent and a JSON body', () => {
        expect(
            toOpenSubtitlesHttpRequest(
                {
                    operation: 'login',
                    apiKey: ` ${KEY} `,
                    body: { username: 'tiago', password: PASSWORD },
                },
                '0.2.5'
            )
        ).toEqual({
            url: 'https://api.opensubtitles.com/api/v1/login',
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Api-Key': KEY,
                'User-Agent': 'TiagoTV v0.2.5',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: 'tiago', password: PASSWORD }),
        });
    });

    it("searches with the query on the login's host only when it is OpenSubtitles'", () => {
        const search = (host: string | null) =>
            toOpenSubtitlesHttpRequest(
                {
                    operation: 'search',
                    apiKey: KEY,
                    host,
                    query: { languages: 'es', tmdb_id: '7', type: 'movie' },
                },
                '1'
            )?.url;

        expect(search('vip-api.opensubtitles.com')).toBe(
            'https://vip-api.opensubtitles.com/api/v1/subtitles?languages=es&tmdb_id=7&type=movie'
        );
        expect(search('attacker.example')).toBe(
            'https://api.opensubtitles.com/api/v1/subtitles?languages=es&tmdb_id=7&type=movie'
        );
    });

    it('downloads with the token, and fetches files from OpenSubtitles only', () => {
        expect(
            toOpenSubtitlesHttpRequest(
                {
                    operation: 'download',
                    apiKey: KEY,
                    token: TOKEN,
                    body: { file_id: 3 },
                },
                '1'
            )?.headers['Authorization']
        ).toBe(`Bearer ${TOKEN}`);
        const file = toOpenSubtitlesHttpRequest(
            {
                operation: 'file',
                apiKey: KEY,
                url: 'https://www.opensubtitles.com/download/x/3.srt',
            },
            '1'
        );
        expect(file?.method).toBe('GET');
        // The file host never receives the key.
        expect(file?.headers).toEqual({ 'User-Agent': 'TiagoTV v1' });
        for (const url of [
            'http://www.opensubtitles.com/x.srt',
            'https://opensubtitles.com.attacker.example/x.srt',
            'https://192.168.1.1/x.srt',
            'not a url',
        ]) {
            expect(
                toOpenSubtitlesHttpRequest(
                    { operation: 'file', apiKey: KEY, url },
                    '1'
                )
            ).toBeNull();
        }
    });

    it('refuses unknown operations and keys that could split headers', () => {
        expect(
            toOpenSubtitlesHttpRequest(
                { operation: 'delete' as never, apiKey: KEY },
                '1'
            )
        ).toBeNull();
        expect(
            toOpenSubtitlesHttpRequest(
                { operation: 'search', apiKey: 'a\r\nX-Evil: 1' },
                '1'
            )
        ).toBeNull();
        expect(
            toOpenSubtitlesHttpRequest({ operation: 'search', apiKey: '' }, '1')
        ).toBeNull();
    });

    it('answers status and JSON, the file as text, and never throws', async () => {
        const fetchImpl = jest
            .fn()
            .mockResolvedValueOnce(
                response('{"remaining":-1}', 406, { 'retry-after': '30' })
            )
            .mockResolvedValueOnce(
                response('1\n00:00:01,000 --> 00:00:02,000\nHola')
            )
            .mockResolvedValueOnce(response('x'.repeat(MAX_SUBTITLE_BYTES + 1)))
            .mockRejectedValueOnce(new Error('offline'));

        await expect(
            runOpenSubtitlesRequest(
                { operation: 'download', apiKey: KEY, body: { file_id: 1 } },
                '1',
                fetchImpl
            )
        ).resolves.toEqual({
            status: 406,
            retryAfterSeconds: 30,
            data: { remaining: -1 },
        });
        await expect(
            runOpenSubtitlesRequest(
                {
                    operation: 'file',
                    apiKey: KEY,
                    url: 'https://dl.opensubtitles.org/x.srt',
                },
                '1',
                fetchImpl
            )
        ).resolves.toEqual(
            expect.objectContaining({
                status: 200,
                text: expect.stringContaining('Hola'),
            })
        );
        await expect(
            runOpenSubtitlesRequest(
                { operation: 'search', apiKey: KEY },
                '1',
                fetchImpl
            )
        ).resolves.toEqual({ status: 0 });
        await expect(
            runOpenSubtitlesRequest(
                { operation: 'search', apiKey: KEY },
                '1',
                fetchImpl
            )
        ).resolves.toEqual({ status: 0 });
        await expect(
            runOpenSubtitlesRequest(
                { operation: 'search', apiKey: '' },
                '1',
                fetchImpl
            )
        ).resolves.toEqual({ status: 400 });
    });

    it('registers the IPC handler through net.fetch and logs nothing it sent', async () => {
        const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
            (method) => jest.spyOn(console, method).mockImplementation()
        );
        mockNetFetch.mockRejectedValue(new Error(`refused ${KEY}`));
        registerOpenSubtitlesHandlers();
        const [channel, handler] = mockHandle.mock.calls[0];

        expect(channel).toBe(OPENSUBTITLES_REQUEST);
        await expect(
            handler(
                {},
                {
                    operation: 'login',
                    apiKey: KEY,
                    token: TOKEN,
                    body: { username: 'tiago', password: PASSWORD },
                }
            )
        ).resolves.toEqual({ status: 0 });
        expect(mockNetFetch).toHaveBeenCalledWith(
            'https://api.opensubtitles.com/api/v1/login',
            expect.objectContaining({ method: 'POST' })
        );
        const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
        for (const secret of [KEY, PASSWORD, TOKEN]) {
            expect(logged).not.toContain(secret);
        }
        spies.forEach((spy) => spy.mockRestore());
    });
});
