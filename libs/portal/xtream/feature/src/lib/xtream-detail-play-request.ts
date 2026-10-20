import { effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
    clearDetailPlayRequest,
    readDetailPlayRequest,
    type DetailPlayMode,
} from '@iptvnator/portal/shared/util';

/**
 * A details page's half of a "play" button elsewhere (the Home, Series /
 * Películas; see `withDetailPlayRequest`). The request is read once, as the
 * page is created: from the navigation that opens it, or from the history
 * entry once that navigation has ended (the inline detail of a collection
 * opens after its rows load). `play` runs once, as soon as the page shows
 * the title asked for and `pick` has what to play; the request then leaves
 * the history entry.
 *
 * Must run in an injection context.
 */
export function playOnDetailRequest<T>(options: {
    /** The id of the title the page shows. */
    contentId: () => number | string | null | undefined;
    /** What to play, once everything it needs is in; null to wait. */
    pick: (mode: DetailPlayMode) => T | null;
    play: (target: T) => void;
}): void {
    const router: Partial<Pick<Router, 'currentNavigation'>> = inject(Router);
    // A router stand-in (tests) may lack the navigation: the entry then.
    const state =
        router.currentNavigation?.()?.extras.state ??
        (typeof history === 'undefined' ? null : history.state);
    const request = readDetailPlayRequest(state);
    if (!request) {
        return;
    }
    let done = false;
    effect(() => {
        if (done || Number(options.contentId()) !== request.contentId) {
            return;
        }
        const target = options.pick(request.mode);
        if (target === null) {
            return;
        }
        done = true;
        untracked(() => {
            clearDetailPlayRequest();
            options.play(target);
        });
    });
}
