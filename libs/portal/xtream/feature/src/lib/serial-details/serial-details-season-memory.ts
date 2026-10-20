/**
 * History-state key of the season a series page showed: Back, Forward or a
 * reload onto the entry open the series on it again, while a new visit
 * starts from the series' own progress.
 */
export const SERIES_SEASON_STATE_KEY = 'xtreamSeriesSeason';

export interface SeriesSeasonIdentity {
    readonly playlistId: string;
    readonly seriesId: number;
}

/** The season `state` (a history entry's) remembers for this series. */
export function recallSeriesSeason(
    state: unknown,
    series: SeriesSeasonIdentity
): string | null {
    const memory =
        state && typeof state === 'object'
            ? (state as Record<string, unknown>)[SERIES_SEASON_STATE_KEY]
            : null;
    if (!memory || typeof memory !== 'object') {
        return null;
    }
    const { playlistId, seriesId, seasonKey } = memory as Record<
        string,
        unknown
    >;
    return playlistId === series.playlistId &&
        seriesId === series.seriesId &&
        typeof seasonKey === 'string' &&
        seasonKey !== ''
        ? seasonKey
        : null;
}

/** Remembers the season shown on the current history entry, adding none. */
export function rememberSeriesSeason(
    series: SeriesSeasonIdentity,
    seasonKey: string
): void {
    try {
        const state =
            window.history.state && typeof window.history.state === 'object'
                ? (window.history.state as Record<string, unknown>)
                : {};
        if (recallSeriesSeason(state, series) === seasonKey) {
            return;
        }
        window.history.replaceState(
            {
                ...state,
                [SERIES_SEASON_STATE_KEY]: {
                    playlistId: series.playlistId,
                    seriesId: series.seriesId,
                    seasonKey,
                },
            },
            document.title
        );
    } catch {
        // A browser that refuses the update keeps no season.
    }
}
