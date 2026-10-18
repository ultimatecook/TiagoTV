import type { PlaybackDiagnostic } from '@iptvnator/playback/util';
import {
    LIVE_START_MAX_RETRIES,
    LIVE_START_RETRY_DELAY_MS,
    LIVE_START_TIMEOUT_MS,
    WebPlayerLiveStartGuard,
    isRetryableLiveStartIssue,
} from './web-player-live-start-guard';

function issue(
    overrides: Partial<PlaybackDiagnostic> = {}
): PlaybackDiagnostic {
    return {
        code: 'network-error',
        source: 'mpegts',
        sourceUrl: 'https://provider.test/live/u/p/1.ts',
        container: 'ts',
        audioCodecs: [],
        videoCodecs: [],
        ...overrides,
    };
}

describe('WebPlayerLiveStartGuard', () => {
    let media: { paused: boolean; readyState: number } | null;
    let guard: WebPlayerLiveStartGuard;
    let reopenWith: symbol;
    const calls: string[] = [];

    beforeEach(() => {
        jest.useFakeTimers();
        calls.length = 0;
        media = { paused: false, readyState: 0 };
        reopenWith = Symbol('reopened');
        guard = new WebPlayerLiveStartGuard({
            release: () => calls.push('release'),
            reopen: () => {
                calls.push('reopen');
                // The view starts the next application, as its effect does.
                guard.watch(reopenWith, true);
            },
            giveUp: () => calls.push('giveUp'),
            media: () => media as HTMLMediaElement | null,
        });
    });

    afterEach(() => {
        guard.stop();
        jest.useRealTimers();
    });

    it('closes a hanging live start, waits for the slot and reopens it', () => {
        guard.watch(Symbol('first'), true);

        jest.advanceTimersByTime(LIVE_START_TIMEOUT_MS - 1);
        expect(calls).toEqual([]);
        jest.advanceTimersByTime(1);
        expect(calls).toEqual(['release']);

        // The connection stays closed for the whole pause.
        jest.advanceTimersByTime(LIVE_START_RETRY_DELAY_MS - 1);
        expect(calls).toEqual(['release']);
        jest.advanceTimersByTime(1);
        expect(calls).toEqual(['release', 'reopen']);
    });

    it('gives up after the bounded retries and lets the diagnostic show', () => {
        guard.watch(Symbol('first'), true);
        for (let retry = 0; retry < LIVE_START_MAX_RETRIES; retry += 1) {
            jest.advanceTimersByTime(
                LIVE_START_TIMEOUT_MS + LIVE_START_RETRY_DELAY_MS
            );
        }
        jest.advanceTimersByTime(LIVE_START_TIMEOUT_MS);

        expect(calls).toEqual([
            'release',
            'reopen',
            'release',
            'reopen',
            'giveUp',
        ]);
        jest.advanceTimersByTime(60_000);
        expect(calls).toHaveLength(5);
    });

    it('retries a refused start, but only for the watched application', () => {
        const first = Symbol('first');
        guard.watch(first, true);

        expect(guard.retry(issue({ httpStatus: 403 }), Symbol('stale'))).toBe(
            false
        );
        guard.watch(first, true);
        expect(guard.retry(issue({ httpStatus: 403 }), first)).toBe(true);
        expect(calls).toEqual(['release']);
        jest.advanceTimersByTime(LIVE_START_RETRY_DELAY_MS);
        expect(calls).toEqual(['release', 'reopen']);

        expect(guard.retry(issue({ httpStatus: 403 }), reopenWith)).toBe(true);
        jest.advanceTimersByTime(LIVE_START_RETRY_DELAY_MS);
        expect(guard.retry(issue({ httpStatus: 403 }), reopenWith)).toBe(false);
    });

    it('leaves started, VOD and autoplay-held playback alone', () => {
        guard.watch(Symbol('live'), true);
        guard.started();
        guard.watch(Symbol('vod'), false);
        jest.advanceTimersByTime(LIVE_START_TIMEOUT_MS * 2);
        expect(calls).toEqual([]);

        media = { paused: true, readyState: 4 };
        guard.watch(Symbol('autoplay-held'), true);
        jest.advanceTimersByTime(LIVE_START_TIMEOUT_MS * 2);
        expect(calls).toEqual([]);
    });

    it('starts counting afresh for a start it did not trigger', () => {
        guard.watch(Symbol('first'), true);
        jest.advanceTimersByTime(LIVE_START_TIMEOUT_MS);
        guard.watch(Symbol('user-retry'), true);
        jest.advanceTimersByTime(LIVE_START_RETRY_DELAY_MS);
        expect(calls).toEqual(['release']);

        // Its own full timeout, not the remainder of the first one.
        jest.advanceTimersByTime(
            LIVE_START_TIMEOUT_MS - LIVE_START_RETRY_DELAY_MS - 1
        );
        expect(calls).toEqual(['release']);
        jest.advanceTimersByTime(1);
        expect(calls).toEqual(['release', 'release']);
    });
});

describe('isRetryableLiveStartIssue', () => {
    it.each([
        [{ httpStatus: 403 }, true],
        [{ httpStatus: 503 }, true],
        [{}, true],
        [{ httpStatus: 404 }, false],
        [{ httpStatus: 401 }, false],
        [{ code: 'media-decode-error' as const }, false],
        // VHS's failed first playlist request: MediaError 4, status lost.
        [
            {
                code: 'unknown-playback-error' as const,
                vhs: {
                    engineType: 'unknown' as const,
                    mediaErrorCode: 4 as const,
                    disposition: 'terminal' as const,
                    stage: 'unknown' as const,
                },
            },
            true,
        ],
        [
            {
                code: 'unknown-playback-error' as const,
                vhs: {
                    engineType: 'streamingfailedtoappendsegment' as const,
                    mediaErrorCode: 3 as const,
                    disposition: 'terminal' as const,
                    stage: 'segment' as const,
                },
            },
            false,
        ],
        [
            {
                code: 'media-decode-error' as const,
                mpegTs: {
                    engineType: 'NetworkError' as const,
                    engineDetails: 'UnrecoverableEarlyEof' as const,
                    disposition: 'terminal' as const,
                    stage: 'loader' as const,
                    failure: 'truncated-stream' as const,
                },
            },
            true,
        ],
    ])('%j → %s', (overrides, expected) => {
        expect(isRetryableLiveStartIssue(issue(overrides))).toBe(expected);
    });
});
