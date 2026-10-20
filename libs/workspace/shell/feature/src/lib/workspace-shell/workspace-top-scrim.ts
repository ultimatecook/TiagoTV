import { afterNextRender, DestroyRef, Signal, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

/** Scrolled further than this, a page's content runs under the bar. */
const SCROLLED_PX = 4;
/**
 * An inner scroller at least this share of the scroller's height is the
 * page's own (a platform's title page scrolls itself); a rail scrolling
 * sideways or a short list inside a page is not.
 */
const PAGE_SCROLLER_SHARE = 0.5;

/**
 * Whether the page under the top bar is scrolled, for the bar's scrim: the
 * shell's scroller, or a page's own full-height scroller inside it. Scroll
 * events do not bubble, so the scroller listens in the capture phase; a
 * navigation re-reads the state (a page that scrolled itself may be gone).
 */
export function watchWorkspaceScrolled(
    router: Router,
    scroller: () => HTMLElement | undefined,
    destroyRef: DestroyRef
): Signal<boolean> {
    const scrolled = signal(false);
    let pageScroller: HTMLElement | null = null;

    const update = () => {
        const element = scroller();
        const own = (element?.scrollTop ?? 0) > SCROLLED_PX;
        const inner =
            !!pageScroller?.isConnected &&
            pageScroller.scrollTop > SCROLLED_PX;
        scrolled.set(own || inner);
    };
    const onScroll = (event: Event) => {
        const element = scroller();
        const target = event.target;
        if (
            element &&
            target instanceof HTMLElement &&
            target !== element &&
            target.clientHeight >= element.clientHeight * PAGE_SCROLLER_SHARE
        ) {
            pageScroller = target;
        }
        update();
    };

    afterNextRender(() => {
        const element = scroller();
        if (!element) {
            return;
        }
        element.addEventListener('scroll', onScroll, {
            capture: true,
            passive: true,
        });
        destroyRef.onDestroy(() =>
            element.removeEventListener('scroll', onScroll, { capture: true })
        );
    });
    const subscription = router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
            update();
        }
    });
    destroyRef.onDestroy(() => subscription.unsubscribe());

    return scrolled.asReadonly();
}
