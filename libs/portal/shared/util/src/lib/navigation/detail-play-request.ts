import {
    clearNavigationStateKeys,
    OPEN_COLLECTION_DETAIL_STATE_KEY,
    type WorkspaceNavigationTarget,
} from './workspace-portal-navigation';

/**
 * Navigation-state key of a "play" button that lands on a detail page: the
 * page starts playing once its title, and the saved positions, are in.
 */
export const DETAIL_PLAY_REQUEST_STATE_KEY = 'detailPlayRequest';

/**
 * `resume`: a movie from where it was left (else from the start); a series
 * the episode its own quick start names (the next one, else the first).
 * `first-episode`: a series' first episode.
 */
export type DetailPlayMode = 'resume' | 'first-episode';

export interface DetailPlayRequest {
    readonly mode: DetailPlayMode;
    /** The movie's stream id or the series id the request is for. */
    readonly contentId: number;
}

/** `target`, asking the detail it opens to start playing. */
export function withDetailPlayRequest(
    target: WorkspaceNavigationTarget,
    request: DetailPlayRequest
): WorkspaceNavigationTarget {
    return {
        ...target,
        state: {
            ...target.state,
            [DETAIL_PLAY_REQUEST_STATE_KEY]: {
                mode: request.mode,
                contentId: request.contentId,
            },
        },
    };
}

/** The request a navigation's (or a history entry's) state carries. */
export function readDetailPlayRequest(
    state: unknown
): DetailPlayRequest | null {
    const record =
        state && typeof state === 'object'
            ? (state as Record<string, unknown>)[DETAIL_PLAY_REQUEST_STATE_KEY]
            : null;
    if (!record || typeof record !== 'object') {
        return null;
    }
    const { mode, contentId } = record as Record<string, unknown>;
    const id = Number(contentId);
    return (mode === 'resume' || mode === 'first-episode') &&
        Number.isInteger(id) &&
        id > 0
        ? { mode, contentId: id }
        : null;
}

/**
 * Takes the request off the current history entry once it was acted on:
 * Back or Forward onto the entry, or another detail the page opens from
 * it, must not start playing again.
 */
export function clearDetailPlayRequest(): void {
    clearNavigationStateKeys([DETAIL_PLAY_REQUEST_STATE_KEY]);
}

/**
 * The other "play on arrival" handoff: the episode a series' Continue asked
 * a collection's inline detail to resume (`seriesResume` of
 * `OPEN_COLLECTION_DETAIL_STATE_KEY`). Taken off the current history entry
 * once the detail took it, keeping the detail itself, so Back, Forward or a
 * reload onto the entry show the series without starting the episode again.
 */
export function clearCollectionDetailSeriesResume(): void {
    try {
        const state = window.history.state as Record<string, unknown> | null;
        const detail = state?.[OPEN_COLLECTION_DETAIL_STATE_KEY];
        if (!detail || typeof detail !== 'object' || !('seriesResume' in detail)) {
            return;
        }
        const kept: Record<string, unknown> = { ...detail };
        delete kept['seriesResume'];
        window.history.replaceState(
            { ...state, [OPEN_COLLECTION_DETAIL_STATE_KEY]: kept },
            document.title
        );
    } catch {
        // A browser that refuses the update keeps the handoff.
    }
}
