import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';
import type { NowPlayingHandoff } from './now-playing-dock.service';

/** The last time update a page player reported. */
export interface NowPlayingProgress {
    readonly currentTime: number;
    readonly duration: number;
    readonly playing: boolean;
}

/** What the page player knows when it is torn down. */
export interface NowPlayingTeardown {
    /** False for the mini-player's own player and non-primary hosts. */
    readonly dockable: boolean;
    /** The teardown comes from a route change, not the page closing it. */
    readonly navigatingAway: boolean;
    readonly streamUrl: string;
    readonly sessionKey: string;
    readonly playback: ResolvedPortalPlayback | null;
    readonly title: string;
    readonly subtitle: string | null;
    readonly isLive: boolean;
    readonly progress: NowPlayingProgress | null;
    /**
     * The page's media element, read for its volume only. By teardown an
     * engine may already have reset it (Video.js disposes its tech first),
     * so position and paused state come from the last progress report.
     */
    readonly video: Pick<
        HTMLVideoElement,
        'volume' | 'muted' | 'currentSrc'
    > | null;
    readonly fallbackVolume: number;
    readonly returnUrl: string;
    readonly returnState: Record<string, unknown> | null;
    /** The page's picture was in picture-in-picture when it was left. */
    readonly pictureInPicture?: boolean;
}

/** Closer than this to the end, a film is finished: nothing to continue. */
const NEAR_END_SECONDS = 8;

/**
 * Whether a page player's teardown continues in the mini-player, and with
 * what. Only a navigation away hands over (closing the player on its page
 * does not), and only a stream that actually started and has not finished.
 */
export function resolveNowPlayingHandoff(
    teardown: NowPlayingTeardown
): NowPlayingHandoff | null {
    if (
        !teardown.dockable ||
        !teardown.navigatingAway ||
        !teardown.streamUrl ||
        teardown.progress === null
    ) {
        return null;
    }

    const currentTime = finiteOr(teardown.progress.currentTime, 0);
    const duration = teardown.isLive
        ? 0
        : finiteOr(teardown.progress.duration, 0);
    if (
        !teardown.isLive &&
        duration > 0 &&
        duration - currentTime <= NEAR_END_SECONDS
    ) {
        return null;
    }
    // A reset element (no source left) no longer holds the user's volume.
    const video = teardown.video?.currentSrc ? teardown.video : null;

    return {
        sessionKey: teardown.sessionKey,
        streamUrl: teardown.streamUrl,
        playback: teardown.playback,
        title: teardown.title,
        subtitle: teardown.subtitle,
        artworkUrl: teardown.playback?.thumbnail ?? null,
        startTime: teardown.isLive ? 0 : currentTime,
        duration,
        isLive: teardown.isLive,
        paused: !teardown.progress.playing,
        volume: finiteOr(video?.volume, teardown.fallbackVolume),
        muted: video?.muted ?? false,
        returnUrl: teardown.returnUrl,
        returnState: teardown.returnState,
        ...(teardown.pictureInPicture ? { pictureInPicture: true } : {}),
    };
}

/** History state minus the router's own bookkeeping keys. */
export function navigationReturnState(
    state: unknown
): Record<string, unknown> | null {
    if (!state || typeof state !== 'object') {
        return null;
    }
    const kept: Record<string, unknown> = {};
    let any = false;
    for (const [key, value] of Object.entries(state)) {
        if (key !== 'navigationId' && key !== 'ɵrouterPageId') {
            kept[key] = value;
            any = true;
        }
    }
    return any ? kept : null;
}

function finiteOr(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? value
        : fallback;
}
