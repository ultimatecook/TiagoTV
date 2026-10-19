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
 * Emits `homeNear` once, when the host comes within `homeNearMargin` of
 * what its scroller shows: a Home section below the fold asks for its data
 * only then (the platforms' catalogs, the channels' programmes). The
 * scroller is the nearest scrolling ancestor (the shell's content pane),
 * whose clip a margin on the viewport could not reach past. Without
 * IntersectionObserver the host counts as near at once.
 */
@Directive({ selector: '[libHomeNear]' })
export class HomeNearDirective {
    readonly homeNearMargin = input('400px');
    readonly homeNear = output<void>();

    constructor() {
        const host: HTMLElement = inject(ElementRef).nativeElement;
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            if (typeof IntersectionObserver === 'undefined') {
                this.homeNear.emit();
                return;
            }
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        observer.disconnect();
                        this.homeNear.emit();
                    }
                },
                {
                    root: scrollParent(host),
                    rootMargin: `${this.homeNearMargin()} 0px`,
                }
            );
            observer.observe(host);
            destroyRef.onDestroy(() => observer.disconnect());
        });
    }
}

/** The nearest ancestor that scrolls vertically; null for the viewport. */
function scrollParent(element: HTMLElement): HTMLElement | null {
    for (
        let parent = element.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
    ) {
        const overflow = getComputedStyle(parent).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
            return parent;
        }
    }
    return null;
}
