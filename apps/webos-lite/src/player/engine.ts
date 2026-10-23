import type { Fluidez } from './fluidez';
import { classifyStatus, type Candidate } from './sources';
import { StallWatch } from './stall';

/**
 * One `<video>` and one stream at a time: the provider's account allows a
 * single connection, and a second request while the first is still open
 * is refused (or counted against the Mac). Before every new stream the
 * engine pauses, removes the source, calls `load()` (which closes the
 * connection), destroys mpegts.js, and waits RELEASE_GAP_MS.
 *
 * `play` tries each candidate in turn; a newer `play` or `stop` cancels
 * an older one wherever it is. A live stream that stops moving for
 * STALL_MS (stall.ts) is reported through `onStall`.
 *
 * In the Android app the media is the native player's stand-in
 * (native-media.ts): `android` candidates open through its session, whose
 * events arrive as the same media events, and `release` stops it.
 */
export interface MediaLike {
    src: string;
    currentTime: number;
    readonly paused: boolean;
    play(): Promise<void> | void;
    pause(): void;
    load(): void;
    removeAttribute(name: string): void;
    appendChild(node: Node): Node;
    removeChild(node: Node): Node;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
}

export interface MpegtsPlayerLike {
    attachMediaElement(media: unknown): void;
    load(): void;
    play(): unknown;
    pause(): void;
    unload(): void;
    detachMediaElement(): void;
    destroy(): void;
    on(event: string, listener: (type: string, detail: string, info?: { code?: number }) => void): void;
}

export interface MpegtsLike {
    isSupported(): boolean;
    createPlayer(source: object, config?: object): MpegtsPlayerLike;
    readonly Events: { readonly ERROR: string };
}

/** The native player's session: the media's events report what it does. */
export interface NativeSession {
    start(candidate: Candidate, options: PlayOptions): void;
    stop(): void;
    /** The HTTP status of the last `error`, when the stream was refused. */
    errorStatus(): number | null;
}

export interface EngineDeps {
    loadMpegts(): Promise<MpegtsLike | null>;
    delay(ms: number): Promise<void>;
    now(): number;
    /** Whether the account's connections are all in use (user_info). */
    isBusy(): Promise<boolean>;
    /** The Android app's native player, when the media stands in for it. */
    native?: NativeSession;
}

export type Outcome =
    | { readonly kind: 'playing'; readonly candidate: Candidate }
    | { readonly kind: 'busy' | 'missing' | 'failed' | 'cancelled' };

export interface PlayOptions {
    readonly startAt?: number;
    readonly timeoutMs?: number;
    /**
     * Refusals to retry after BUSY_RETRY_MS: a provider keeps counting a
     * closed connection for a few seconds, so the channel opened right
     * after another can be refused once (as the desktop app's live start
     * guard does).
     */
    readonly busyRetries?: number;
    /** Live: watch for a stalled picture once it plays. */
    readonly live?: boolean;
    /** mpegts.js's first IO buffer, in bytes (Fluidez). */
    readonly stashBytes?: number;
    /** Fluidez, for the native player's buffers. */
    readonly profile?: Fluidez;
}

interface Attempt {
    readonly ok: boolean;
    readonly status: number | null;
}

export const RELEASE_GAP_MS = 300;
export const BUSY_RETRY_MS = 3000;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_STASH = 1024 * 1024;

/** mpegts.js for a weak TV: buffer ahead, never chase latency. */
export function mpegtsConfig(stashBytes: number, worker: boolean): object {
    return {
        enableWorker: worker,
        enableStashBuffer: true,
        stashInitialSize: stashBytes,
        liveBufferLatencyChasing: false,
        lazyLoad: false,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
        statisticsInfoReportInterval: 5000,
    };
}

function quietly(run: () => unknown): void {
    try {
        const result = run() as Promise<unknown> | undefined;
        if (result && typeof result.then === 'function') {
            result.then(undefined, () => undefined);
        }
    } catch {
        // A player torn down twice, a play() the browser refuses: ignored.
    }
}

export class PlayerEngine {
    private generation = 0;
    private attached = false;
    private readyAt = 0;
    private player: MpegtsPlayerLike | null = null;
    private sourceEl: HTMLSourceElement | null = null;
    private settle: ((attempt: Attempt) => void) | null = null;
    private cleanup: (() => void) | null = null;
    private readonly stall: StallWatch;
    /** mpegts.js transmuxes in a worker until a worker attempt hangs. */
    private worker = true;
    /** A stream that was playing failed (cut, provider closed it). */
    onBroken: ((status: number | null) => void) | null = null;
    /** A live stream stopped moving for STALL_MS. */
    onStall: (() => void) | null = null;
    /** A candidate failed (not refused as busy): the HLS mediaOption guard. */
    onAttemptFailed: ((candidate: Candidate) => void) | null = null;
    /** Streams opened since the engine was made (for tests and the OSD). */
    opened = 0;
    /** Whether streams play in the Android app's native player. */
    get isNative(): boolean {
        return !!this.deps.native;
    }
    /** The latest attempts, "HLS:failed", "TS:playing" (no URLs). */
    readonly attempts: string[] = [];

    constructor(
        readonly media: MediaLike,
        private readonly deps: EngineDeps
    ) {
        this.stall = new StallWatch(media, deps.now, () => this.onStall?.());
    }

    /** Stops whatever plays (or is starting) and frees the connection. */
    async stop(): Promise<void> {
        this.generation++;
        await this.release();
    }

    private note(candidate: Candidate, result: string): void {
        this.attempts.push(`${candidate.label}:${result}`);
        if (this.attempts.length > 20) {
            this.attempts.shift();
        }
    }

    async play(candidates: readonly Candidate[], options: PlayOptions = {}): Promise<Outcome> {
        const generation = ++this.generation;
        let missing = false;
        let retries = options.busyRetries ?? 0;
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            await this.release();
            if (generation !== this.generation) {
                return { kind: 'cancelled' };
            }
            const attempt = await this.attempt(candidate, options);
            if (generation !== this.generation) {
                return { kind: 'cancelled' };
            }
            if (attempt.ok) {
                this.note(candidate, 'playing');
                if (options.live) {
                    this.stall.start();
                }
                return { kind: 'playing', candidate };
            }
            const failure = classifyStatus(attempt.status);
            this.note(candidate, failure === 'other' ? 'failed' : failure);
            if (failure !== 'busy') {
                this.onAttemptFailed?.(candidate);
            }
            if (failure === 'busy' && retries > 0) {
                retries--;
                await this.release();
                await this.deps.delay(BUSY_RETRY_MS);
                i--;
                continue;
            }
            if (failure === 'busy') {
                await this.release();
                return { kind: 'busy' };
            }
            missing = missing || failure === 'missing';
        }
        await this.release();
        if (generation !== this.generation) {
            return { kind: 'cancelled' };
        }
        const busy = await this.deps.isBusy().then(
            (value) => value,
            () => false
        );
        if (generation !== this.generation) {
            return { kind: 'cancelled' };
        }
        return { kind: busy ? 'busy' : missing ? 'missing' : 'failed' };
    }

    private async release(): Promise<void> {
        this.stall.end();
        const settle = this.settle;
        this.settle = null;
        settle?.({ ok: false, status: null });
        if (this.cleanup) {
            this.cleanup();
            this.cleanup = null;
        }
        const player = this.player;
        this.player = null;
        if (player) {
            quietly(() => player.pause());
            quietly(() => player.unload());
            quietly(() => player.detachMediaElement());
            quietly(() => player.destroy());
        }
        if (this.attached) {
            this.attached = false;
            if (this.deps.native) {
                quietly(() => this.deps.native?.stop());
            } else {
                quietly(() => this.media.pause());
                if (this.sourceEl) {
                    const source = this.sourceEl;
                    this.sourceEl = null;
                    quietly(() => this.media.removeChild(source));
                }
                this.media.removeAttribute('src');
                quietly(() => this.media.load());
            }
            this.readyAt = this.deps.now() + RELEASE_GAP_MS;
        }
        const wait = this.readyAt - this.deps.now();
        if (wait > 0) {
            await this.deps.delay(wait);
        }
    }

    private attempt(candidate: Candidate, options: PlayOptions): Promise<Attempt> {
        return new Promise<Attempt>((resolve) => {
            const media = this.media;
            let done = false;
            let playing = false;
            const finish = (attempt: Attempt) => {
                if (done) {
                    return;
                }
                done = true;
                playing = attempt.ok;
                clearTimeout(timer);
                if (this.settle === finish) {
                    this.settle = null;
                }
                resolve(attempt);
            };
            const fail = (status: number | null) => {
                if (done) {
                    if (playing) {
                        this.onBroken?.(status);
                    }
                    return;
                }
                finish({ ok: false, status });
            };
            const onPlaying = () => finish({ ok: true, status: null });
            const onError = () => fail(this.deps.native ? this.deps.native.errorStatus() : null);
            const onMetadata = () => {
                if (options.startAt && options.startAt > 0) {
                    quietly(() => (media.currentTime = options.startAt as number));
                }
            };
            media.addEventListener('playing', onPlaying);
            media.addEventListener('error', onError);
            media.addEventListener('loadedmetadata', onMetadata);
            this.cleanup = () => {
                media.removeEventListener('playing', onPlaying);
                media.removeEventListener('error', onError);
                media.removeEventListener('loadedmetadata', onMetadata);
            };
            this.settle = finish;
            const timer = setTimeout(() => {
                if (candidate.engine === 'mpegts' && this.worker) {
                    // A worker that never started (file://, an old engine):
                    // the next mpegts.js attempt transmuxes inline.
                    this.worker = false;
                }
                fail(null);
            }, candidate.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
            this.attached = true;
            this.opened++;
            if (candidate.engine === 'android') {
                if (this.deps.native) {
                    this.deps.native.start(candidate, options);
                } else {
                    fail(null);
                }
                return;
            }
            if (candidate.engine === 'native') {
                this.attachNative(candidate, onError);
                return;
            }
            this.attachMpegts(candidate, options, () => done, fail);
        });
    }

    private attachNative(candidate: Candidate, onError: () => void): void {
        const media = this.media;
        if (candidate.type) {
            // A <source> carries LG's mediaOption in its type; its errors
            // fire on it, not on the video.
            const source = document.createElement('source');
            source.addEventListener('error', onError);
            source.setAttribute('type', candidate.type);
            source.setAttribute('src', candidate.url);
            this.sourceEl = source;
            media.appendChild(source);
            quietly(() => media.load());
        } else {
            media.src = candidate.url;
        }
        quietly(() => media.play());
    }

    private attachMpegts(
        candidate: Candidate,
        options: PlayOptions,
        isDone: () => boolean,
        fail: (status: number | null) => void
    ): void {
        this.deps.loadMpegts().then(
            (lib) => {
                if (isDone()) {
                    return;
                }
                if (!lib || !lib.isSupported()) {
                    fail(null);
                    return;
                }
                const player = lib.createPlayer(
                    { type: 'mpegts', isLive: true, url: candidate.url },
                    mpegtsConfig(options.stashBytes ?? DEFAULT_STASH, this.worker)
                );
                this.player = player;
                player.on(lib.Events.ERROR, (_type, detail, info) => {
                    const status = detail === 'HttpStatusCodeInvalid' && info ? (info.code ?? null) : null;
                    if (status === null) {
                        // Maybe the worker (its fetch, its start): inline next time.
                        this.worker = false;
                    }
                    fail(status);
                });
                player.attachMediaElement(this.media);
                player.load();
                quietly(() => player.play());
            },
            () => fail(null)
        );
    }
}
