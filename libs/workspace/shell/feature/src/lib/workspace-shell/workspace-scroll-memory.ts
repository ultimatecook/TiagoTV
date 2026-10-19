import { DestroyRef } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/** Remembered positions; older navigations are forgotten. */
const MAX_POSITIONS = 50;
/** A restored page may still be filling in: retry this long at most. */
const RESTORE_WINDOW_MS = 800;

/**
 * Every page shares the workspace scroller, which the router does not
 * reset: each new page starts at the top, as a new screen. Going back or
 * forward through history returns the page to where it was left (once its
 * content is tall enough again). A change of query parameters alone, a
 * search term for one, keeps the position.
 */
export function followWorkspaceScroll(
    router: Router,
    scroller: () => HTMLElement | undefined,
    destroyRef: DestroyRef
): void {
    const positions = new Map<number, number>();
    let currentId = 0;
    let restoreId: number | null = null;
    let currentPath = pathOf(router.url);
    let cancelRestore: (() => void) | null = null;

    const subscription = router.events.subscribe((event) => {
        if (event instanceof NavigationStart) {
            const element = scroller();
            if (element) {
                positions.set(currentId, element.scrollTop);
                trim(positions);
            }
            restoreId = event.restoredState?.navigationId ?? null;
            return;
        }
        if (!(event instanceof NavigationEnd)) {
            return;
        }
        currentId = event.id;
        const path = pathOf(event.urlAfterRedirects);
        if (path === currentPath) {
            return;
        }
        currentPath = path;
        const element = scroller();
        if (!element) {
            return;
        }
        cancelRestore?.();
        element.scrollTop = 0;
        const target = restoreId === null ? 0 : (positions.get(restoreId) ?? 0);
        cancelRestore = target > 0 ? restoreScroll(element, target) : null;
    });
    destroyRef.onDestroy(() => {
        subscription.unsubscribe();
        cancelRestore?.();
    });
}

/** Scrolls back to `top` once the page has grown tall enough for it. */
function restoreScroll(element: HTMLElement, top: number): () => void {
    const view = element.ownerDocument.defaultView;
    if (!view) {
        return () => undefined;
    }
    const started = view.performance.now();
    let frame = 0;
    const attempt = () => {
        element.scrollTop = top;
        const reached = Math.abs(element.scrollTop - top) < 2;
        if (!reached && view.performance.now() - started < RESTORE_WINDOW_MS) {
            frame = view.requestAnimationFrame(attempt);
        }
    };
    frame = view.requestAnimationFrame(attempt);
    // The user's own scroll wins over a restore still waiting.
    const stop = () => view.cancelAnimationFrame(frame);
    element.addEventListener('wheel', stop, { once: true, passive: true });
    return () => {
        stop();
        element.removeEventListener('wheel', stop);
    };
}

function pathOf(url: string): string {
    return url.split(/[?#]/)[0];
}

function trim(positions: Map<number, number>): void {
    while (positions.size > MAX_POSITIONS) {
        const oldest = positions.keys().next().value;
        if (oldest === undefined) {
            return;
        }
        positions.delete(oldest);
    }
}
