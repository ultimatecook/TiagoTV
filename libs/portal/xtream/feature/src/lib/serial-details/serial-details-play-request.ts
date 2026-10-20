import {
    getSeriesNextUp,
    isPortalPlaybackWatched,
    type DetailPlayMode,
    type SeriesQuickStartAction,
} from '@iptvnator/portal/shared/util';
import type {
    PlaybackPositionData,
    XtreamSerieEpisode,
} from '@iptvnator/shared/interfaces';

export interface RequestedEpisode {
    readonly episode: XtreamSerieEpisode;
    /** A finished episode starts again rather than at its end. */
    readonly fromStart: boolean;
}

/**
 * The episode a "play" button elsewhere asked the series page for (see
 * `playOnDetailRequest`): the first one (`first-episode`), or the one the
 * page's own quick start names (`resume`) — the first again once the
 * series is watched through. Null while the episodes or the saved
 * positions are not in.
 */
export function requestedSeriesEpisode(request: {
    readonly mode: DetailPlayMode;
    readonly seasons: Readonly<Record<string, readonly XtreamSerieEpisode[]>>;
    readonly positionsLoaded: boolean;
    readonly positions: ReadonlyMap<number, PlaybackPositionData>;
    readonly quickStart: SeriesQuickStartAction | null;
}): RequestedEpisode | null {
    if (!request.positionsLoaded) {
        return null;
    }
    const quickStart = request.quickStart;
    if (request.mode === 'resume' && quickStart && !quickStart.disabled) {
        return { episode: quickStart.episode, fromStart: false };
    }
    // As if nothing were watched: the series' first episode.
    const start = getSeriesNextUp({
        seasons: request.seasons,
        playbackPositions: new Map(),
    });
    const first =
        start && start.kind !== 'caught-up' ? start.entry.episode : null;
    if (!first) {
        return null;
    }
    return {
        episode: first,
        fromStart: isPortalPlaybackWatched(
            request.positions.get(Number(first.id)) ?? null
        ),
    };
}
