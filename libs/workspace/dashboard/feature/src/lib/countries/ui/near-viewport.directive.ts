import {
    afterNextRender,
    DestroyRef,
    Directive,
    ElementRef,
    inject,
    input,
    output,
} from '@angular/core';

/**
 * Emits `near` once, when the host comes within `nearMargin` of what its
 * scroller shows: a long page of rows (the Series and Movies catalog)
 * renders a row's cards only then, so it opens on the few rows in view.
 * The scroller is the host's nearest scrolling ancestor. Without
 * IntersectionObserver the host counts as near at once.
 */
@Directive({ selector: '[libNearViewport]' })
export class NearViewportDirective {
    readonly nearMargin = input('600px');
    readonly near = output<void>();

    constructor() {
        const host: HTMLElement = inject(ElementRef).nativeElement;
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            if (typeof IntersectionObserver === 'undefined') {
                this.near.emit();
                return;
            }
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        observer.disconnect();
                        this.near.emit();
                    }
                },
                {
                    root: scrollParent(host),
                    rootMargin: `${this.nearMargin()} 0px`,
                }
            );
            observer.observe(host);
            destroyRef.onDestroy(() => observer.disconnect());
        });
    }
}

/** The nearest ancestor that scrolls vertically; null for the viewport. */
export function scrollParent(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
        const overflow = getComputedStyle(parent).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
}
