import {
    afterNextRender,
    DestroyRef,
    Directive,
    ElementRef,
    inject,
    input,
} from '@angular/core';
import { isNumber, recallPageChoice, rememberPageChoice } from './page-memory';

/** A scroll is remembered once it rests this long. */
export const SCROLL_REST_MS = 160;
/** A row may still be filling in when it comes back: retry this long. */
export const SCROLL_RESTORE_MS = 1500;

/**
 * `[libRememberScroll]="'catalog-row-drama'"` on a sideways row: where it
 * was scrolled to stays on the history entry (`rememberPageChoice`), so
 * Back and Forward bring the row back to it, as the shell does for the
 * page's own scroll. An empty key remembers nothing.
 */
@Directive({ selector: '[libRememberScroll]' })
export class RememberScrollDirective {
    readonly key = input('', { alias: 'libRememberScroll' });

    constructor() {
        const element: HTMLElement = inject(ElementRef).nativeElement;
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            const key = this.key();
            if (!key) {
                return;
            }
            const memoryKey = `scroll:${key}`;
            const left = recallPageChoice(memoryKey, isNumber);
            const stopRestore =
                left && left > 0 ? restoreScrollLeft(element, left) : null;
            let timer: ReturnType<typeof setTimeout> | null = null;
            const onScroll = () => {
                if (timer !== null) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    timer = null;
                    rememberPageChoice(
                        memoryKey,
                        Math.round(element.scrollLeft)
                    );
                }, SCROLL_REST_MS);
            };
            element.addEventListener('scroll', onScroll, { passive: true });
            destroyRef.onDestroy(() => {
                stopRestore?.();
                element.removeEventListener('scroll', onScroll);
                if (timer !== null) {
                    clearTimeout(timer);
                }
            });
        });
    }
}

/**
 * Scrolls `element` back to `left` once it is wide enough for it; the
 * user's own wheel or press wins over a restore still waiting.
 */
function restoreScrollLeft(element: HTMLElement, left: number): () => void {
    const view = element.ownerDocument.defaultView;
    if (!view) {
        return () => undefined;
    }
    const started = view.performance.now();
    let frame = 0;
    const attempt = () => {
        element.scrollLeft = left;
        const reached = Math.abs(element.scrollLeft - left) < 2;
        if (!reached && view.performance.now() - started < SCROLL_RESTORE_MS) {
            frame = view.requestAnimationFrame(attempt);
        }
    };
    attempt();
    const stop = () => {
        view.cancelAnimationFrame(frame);
        element.removeEventListener('wheel', stop);
        element.removeEventListener('pointerdown', stop);
    };
    element.addEventListener('wheel', stop, { once: true, passive: true });
    element.addEventListener('pointerdown', stop, { once: true });
    return stop;
}
