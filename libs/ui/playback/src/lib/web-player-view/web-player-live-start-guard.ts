import {
    MpegTsPlaybackEngineDetails,
    PlaybackDiagnosticCode,
    VhsPlaybackMediaErrorCode,
    VhsPlaybackUnknownEngineType,
    type PlaybackDiagnostic,
} from '@iptvnator/playback/util';

/** A live start that has not played after this long has stalled. */
export const LIVE_START_TIMEOUT_MS = 12_000;
/** Closed-connection pause before reopening: the provider frees the slot. */
export const LIVE_START_RETRY_DELAY_MS = 4_000;
/** Automatic reopenings of one start before its diagnostic shows. */
export const LIVE_START_MAX_RETRIES = 2;

/** `HTMLMediaElement.HAVE_CURRENT_DATA`: media data has arrived. */
const HAVE_CURRENT_DATA = 2;

export interface WebPlayerLiveStartGuardDeps {
    /** Unmounts the current application, which closes its connection. */
    readonly release: () => void;
    /** Starts the same playback again as a new application. */
    readonly reopen: () => void;
    /** The start stalled again and the retries are spent. */
    readonly giveUp: () => void;
    /** The mounted engine's media element, if any. */
    readonly media: () => HTMLMediaElement | null;
}

/**
 * Recovers live starts that a provider refuses or leaves hanging. IPTV
 * accounts often allow one connection and keep counting a closed one for a
 * few seconds, so a channel opened right after another is refused (HTTP 403)
 * or simply never answered — before, the player then waited forever. The
 * guard watches each live application until it plays: a refusal, a
 * provider-closed stream or {@link LIVE_START_TIMEOUT_MS} without playback
 * closes the connection, waits {@link LIVE_START_RETRY_DELAY_MS} and opens
 * it again, at most {@link LIVE_START_MAX_RETRIES} times. Then the normal
 * diagnostic shows. VOD and started playback are never touched.
 */
export class WebPlayerLiveStartGuard {
    private watched: symbol | null = null;
    private attempts = 0;
    private reopening = false;
    private startTimer: ReturnType<typeof setTimeout> | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly deps: WebPlayerLiveStartGuardDeps) {}

    /**
     * A new application starts. Its own reopenings keep counting attempts;
     * any other start (channel, source, player, Retry) begins afresh.
     */
    watch(application: symbol, isLive: boolean): void {
        this.clearTimers();
        if (!this.reopening) {
            this.attempts = 0;
        }
        this.reopening = false;
        this.watched = isLive ? application : null;
        if (this.watched) {
            this.startTimer = setTimeout(
                () => this.stalled(),
                LIVE_START_TIMEOUT_MS
            );
        }
    }

    /** The application played: its start is over. */
    started(): void {
        this.stop();
        this.attempts = 0;
    }

    /**
     * Whether a terminal issue of the watched application is retried
     * instead of shown. False ends the watch.
     */
    retry(issue: PlaybackDiagnostic, application: symbol): boolean {
        if (
            this.watched !== application ||
            this.attempts >= LIVE_START_MAX_RETRIES ||
            !isRetryableLiveStartIssue(issue)
        ) {
            this.stop();
            return false;
        }
        this.scheduleReopen();
        return true;
    }

    /** Ends the watch, including a pending reopening. */
    stop(): void {
        this.clearTimers();
        this.watched = null;
        this.reopening = false;
    }

    private stalled(): void {
        this.startTimer = null;
        const media = this.deps.media();
        // Data arrived and only autoplay is held back: the stream works.
        if (media?.paused && media.readyState >= HAVE_CURRENT_DATA) {
            this.watched = null;
            return;
        }
        if (this.attempts >= LIVE_START_MAX_RETRIES) {
            this.watched = null;
            this.deps.giveUp();
            return;
        }
        this.scheduleReopen();
    }

    private scheduleReopen(): void {
        this.clearTimers();
        this.attempts += 1;
        this.watched = null;
        this.deps.release();
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.reopening = true;
            this.deps.reopen();
        }, LIVE_START_RETRY_DELAY_MS);
    }

    private clearTimers(): void {
        if (this.startTimer !== null) clearTimeout(this.startTimer);
        if (this.retryTimer !== null) clearTimeout(this.retryTimer);
        this.startTimer = null;
        this.retryTimer = null;
    }
}

/**
 * Refusals a busy connection slot produces: 403/429/5xx, a request that
 * failed without a response, a live stream the provider closed, and a
 * Video.js HLS start whose first playlist request failed — VHS then ends the
 * MediaSource with `'network'`, which the element reports as MediaError 4
 * without the HTTP status or an engine type. A missing channel (404/410) or
 * bad credentials (401) are not retried.
 */
export function isRetryableLiveStartIssue(issue: PlaybackDiagnostic): boolean {
    if (issue.code === PlaybackDiagnosticCode.NetworkError) {
        const status = issue.httpStatus;
        return (
            status === undefined ||
            status === 403 ||
            status === 408 ||
            status === 429 ||
            status >= 500
        );
    }
    if (
        issue.vhs?.engineType === VhsPlaybackUnknownEngineType &&
        issue.vhs.mediaErrorCode ===
            VhsPlaybackMediaErrorCode.SourceNotSupported
    ) {
        return true;
    }
    return (
        issue.mpegTs?.engineDetails ===
        MpegTsPlaybackEngineDetails.UnrecoverableEarlyEof
    );
}
