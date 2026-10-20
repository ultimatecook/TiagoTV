import { TestBed } from '@angular/core/testing';
import type {
    EmbeddedMpvSession,
    ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { PlaybackStreamOwner } from '../now-playing/playback-stream-owner';
import { EmbeddedMpvSessionController } from './embedded-mpv-session-controller';

/**
 * One stream at a time across the app: a fake bridge plays the main
 * process, which counts the native sessions alive with a stream loaded.
 */
describe('EmbeddedMpvSessionController (one stream at a time)', () => {
    let nextId: number;
    let live: Set<string>;
    let maxLive: number;
    let pendingDisposes: Map<string, () => void>;
    let electron: Record<string, jest.Mock | string>;

    beforeEach(() => {
        jest.useFakeTimers();
        nextId = 1;
        live = new Set();
        maxLive = 0;
        pendingDisposes = new Map();
        electron = {
            platform: 'darwin',
            getEmbeddedMpvSupport: jest
                .fn()
                .mockResolvedValue({ supported: true, platform: 'darwin' }),
            prepareEmbeddedMpv: jest
                .fn()
                .mockResolvedValue({ supported: true, platform: 'darwin' }),
            createEmbeddedMpvSession: jest.fn(async () =>
                createSession(`mpv-${nextId++}`)
            ),
            loadEmbeddedMpvPlayback: jest.fn(async (id: string) => {
                live.add(id);
                maxLive = Math.max(maxLive, live.size);
            }),
            // The main process answers a dispose once mpv is torn down;
            // the test decides when.
            disposeEmbeddedMpvSession: jest.fn(
                (id: string) =>
                    new Promise<null>((resolve) =>
                        pendingDisposes.set(id, () => {
                            live.delete(id);
                            resolve(null);
                        })
                    )
            ),
            setEmbeddedMpvBounds: jest.fn().mockResolvedValue(undefined),
            onEmbeddedMpvSessionUpdate: jest.fn(() => jest.fn()),
        };
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: electron,
        });
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: class {
                observe = jest.fn();
                disconnect = jest.fn();
            },
        });
        Object.defineProperty(window, 'requestAnimationFrame', {
            configurable: true,
            value: (callback: FrameRequestCallback) =>
                window.setTimeout(() => callback(0), 0),
        });
        Object.defineProperty(window, 'cancelAnimationFrame', {
            configurable: true,
            value: (handle: number) => window.clearTimeout(handle),
        });
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
        });
    });

    afterEach(() => {
        TestBed.resetTestingModule();
        delete (window as unknown as { electron?: unknown }).electron;
        jest.useRealTimers();
    });

    /** A player's own controller, as each Embedded MPV view provides one. */
    function player(): EmbeddedMpvSessionController {
        return TestBed.runInInjectionContext(
            () => new EmbeddedMpvSessionController()
        );
    }

    function finishDispose(id: string): void {
        pendingDisposes.get(id)?.();
        pendingDisposes.delete(id);
    }

    it("creates its session only once another player's is disposed", async () => {
        const page = player();
        const leavePage = page.startSession(host(), playback('A'), 1);
        await waitFor(() => live.has('mpv-1'), 'the first stream to load');

        // The page is left mid-playback (or zapped to another channel) and
        // the next player starts while mpv-1 is still being torn down.
        leavePage();
        const next = player();
        const stopNext = next.startSession(host(), playback('B'), 1);
        await flush();

        expect(electron['disposeEmbeddedMpvSession']).toHaveBeenCalledWith(
            'mpv-1'
        );
        expect(electron['createEmbeddedMpvSession']).toHaveBeenCalledTimes(1);

        finishDispose('mpv-1');
        await waitFor(() => live.has('mpv-2'), 'the second stream to load');
        expect(maxLive).toBe(1);
        stopNext();
    });

    it('never loads more than one stream through fast zapping', async () => {
        const teardowns: (() => void)[] = [];
        for (const name of ['A', 'B', 'C', 'D']) {
            teardowns.forEach((teardown) => teardown());
            teardowns.length = 0;
            teardowns.push(player().startSession(host(), playback(name), 1));
            await drainRound();
            [...pendingDisposes.keys()].forEach(finishDispose);
        }
        for (let round = 0; round < 20; round += 1) {
            [...pendingDisposes.keys()].forEach(finishDispose);
            await drainRound();
        }

        expect(maxLive).toBe(1);
        expect(live.size).toBe(1);
        teardowns.forEach((teardown) => teardown());
    });

    it('holds web players back until the native session is disposed', async () => {
        const streams = TestBed.inject(PlaybackStreamOwner);
        const page = player();
        const leavePage = page.startSession(host(), playback('A'), 1);
        await waitFor(() => live.has('mpv-1'), 'the stream to load');

        leavePage();
        const webPlayer = { stop: jest.fn() };
        streams.claim(webPlayer);
        expect(streams.blocked(webPlayer)).toBe(true);

        finishDispose('mpv-1');
        await flush();
        expect(streams.blocked(webPlayer)).toBe(false);
    });
});

function host(): HTMLElement {
    return {
        getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            width: 640,
            height: 360,
        }),
    } as HTMLElement;
}

function playback(name: string): ResolvedPortalPlayback {
    return {
        streamUrl: `https://example.com/live/${name}.ts`,
        title: name,
        isLive: true,
    };
}

function createSession(id: string): EmbeddedMpvSession {
    return {
        id,
        title: '',
        streamUrl: '',
        status: 'idle',
        positionSeconds: 0,
        durationSeconds: null,
        volume: 1,
        audioTracks: [],
        selectedAudioTrackId: null,
        subtitleTracks: [],
        selectedSubtitleTrackId: null,
        playbackSpeed: 1,
        aspectOverride: 'no',
        recording: { active: false },
        startedAt: '2026-10-19T00:00:00.000Z',
        updatedAt: '2026-10-19T00:00:00.000Z',
    };
}

async function drainRound(): Promise<void> {
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1);
}

async function waitFor(
    condition: () => boolean,
    description: string
): Promise<void> {
    for (let round = 0; round < 100; round += 1) {
        if (condition()) {
            return;
        }
        await drainRound();
    }
    throw new Error(`Timed out waiting for ${description}`);
}

async function flush(): Promise<void> {
    for (let round = 0; round < 10; round += 1) {
        await drainRound();
    }
}
