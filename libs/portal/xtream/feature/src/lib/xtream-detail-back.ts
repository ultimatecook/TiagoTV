import { inject, InjectionToken } from '@angular/core';
import {
    WorkspaceBackNavigationService,
    type WorkspaceBackParent,
} from '@iptvnator/portal/shared/data-access';

/**
 * Provided by a collection's inline detail (Mi lista, Recientes): the
 * title's Back closes the detail in its collection, which steps history Back
 * to the list, or shows the list in place when the detail opened the
 * session (see `createCollectionDetailState`).
 */
export const XTREAM_INLINE_DETAIL_CLOSE = new InjectionToken<() => void>(
    'XTREAM_INLINE_DETAIL_CLOSE'
);

/**
 * Where a title page's Back leads when no in-app page opened it (a deep
 * link, a fresh tab, an entry from before a reload): the tab the top bar
 * lights for it.
 */
export const XTREAM_DETAIL_BACK_PARENT: Readonly<
    Record<'movie' | 'series', WorkspaceBackParent>
> = {
    movie: '/workspace/movies',
    series: '/workspace/series',
};

/**
 * A title page's Back: the header's arrow, and through it the mouse's Back
 * button and Cmd+[ (every Back gesture in Electron). History Back while the
 * previous entry is this app's, else the title's tab page replaces the
 * entry, so Back never leaves the app or reloads it.
 *
 * It never closes the player first: the navigation tears the page down, and
 * a playing stream goes on in the mini-player (Escape in watch mode is the
 * explicit close). Must run in an injection context.
 */
export function injectXtreamDetailBack(kind: 'movie' | 'series'): () => void {
    const backNavigation = inject(WorkspaceBackNavigationService);
    const closeInline = inject(XTREAM_INLINE_DETAIL_CLOSE, { optional: true });
    return () =>
        closeInline
            ? closeInline()
            : backNavigation.back(() => XTREAM_DETAIL_BACK_PARENT[kind]);
}
