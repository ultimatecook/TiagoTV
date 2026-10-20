import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    input,
    signal,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { RememberScrollDirective } from '../../ui-state/remember-scroll.directive';

/**
 * A sideways row of the catalog page: its cards (each a `[data-stop]`
 * child) run on through the page's gutters to the content's edges, one tab
 * stop for the row (the arrow keys, Home and End move along it) and, for a
 * pointer, a chevron on each side that has more to show. The parent sets
 * the column width (`--strip-column`) and where the chevrons sit
 * (`--strip-chevron-top`, the middle of its artwork). With a `memoryKey`
 * the row's sideways scroll comes back with Back and Forward.
 */
@Component({
    selector: 'lib-catalog-strip',
    imports: [MatIcon, RememberScrollDirective, TranslatePipe],
    template: `
        <button
            type="button"
            class="chevron chevron--left"
            tabindex="-1"
            [class.chevron--on]="canScrollLeft()"
            [attr.aria-label]="'PORTALS.SCROLL_LEFT' | translate"
            (click)="scrollBy(-1)"
        >
            <mat-icon>chevron_left</mat-icon>
        </button>
        <div
            #track
            class="track"
            role="toolbar"
            aria-orientation="horizontal"
            [attr.aria-labelledby]="labelledBy()"
            [libRememberScroll]="memoryKey()"
            (scroll)="updateEdges()"
        >
            <ng-content />
        </div>
        <button
            type="button"
            class="chevron chevron--right"
            tabindex="-1"
            [class.chevron--on]="canScrollRight()"
            [attr.aria-label]="'PORTALS.SCROLL_RIGHT' | translate"
            (click)="scrollBy(1)"
        >
            <mat-icon>chevron_right</mat-icon>
        </button>
    `,
    styles: `
        :host {
            --strip-column: 188px;
            --strip-chevron-top: 50%;
            position: relative;
            display: block;
            min-width: 0;
        }

        .track {
            display: grid;
            grid-auto-columns: var(--strip-column);
            grid-auto-flow: column;
            gap: 16px;
            margin: 0 calc(-1 * var(--tv-page-x));
            padding: 4px var(--tv-page-x) 8px;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior-x: contain;
            scroll-padding-inline: var(--tv-page-x);
            scrollbar-width: none;

            &::-webkit-scrollbar {
                display: none;
            }
        }

        .chevron {
            position: absolute;
            z-index: 2;
            top: var(--strip-chevron-top);
            display: none;
            place-items: center;
            width: 40px;
            height: 40px;
            padding: 0;
            border: 1px solid var(--tv-glass-border);
            border-radius: 50%;
            background: rgba(14, 14, 12, 0.72);
            color: var(--tv-text);
            box-shadow: var(--tv-shadow-float);
            cursor: pointer;
            opacity: 0;
            transform: translateY(-50%);
            transition: opacity 160ms ease;

            mat-icon {
                width: 24px;
                height: 24px;
                font-size: 24px;
            }
        }

        .chevron--left {
            left: calc(-1 * var(--tv-page-x) + 10px);
        }

        .chevron--right {
            right: calc(-1 * var(--tv-page-x) + 10px);
        }

        @media (hover: hover) {
            .chevron--on {
                display: grid;
            }

            :host(:hover) .chevron--on {
                opacity: 1;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .chevron {
                transition: none;
            }
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(keydown)': 'onKeydown($event)',
        '(focusin)': 'onFocusIn($event)',
    },
})
export class CatalogStripComponent {
    /** The id of the row's heading, which names the toolbar. */
    readonly labelledBy = input<string | null>(null);
    /** The history entry's key for the row's scroll; none, not kept. */
    readonly memoryKey = input('');
    private readonly track =
        viewChild.required<ElementRef<HTMLElement>>('track');
    readonly canScrollLeft = signal(false);
    readonly canScrollRight = signal(false);

    constructor() {
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            this.updateEdges();
            if (typeof ResizeObserver === 'undefined') {
                return;
            }
            const observer = new ResizeObserver(() => this.updateEdges());
            observer.observe(this.track().nativeElement);
            destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    scrollBy(direction: 1 | -1): void {
        const track = this.track().nativeElement;
        track.scrollBy({
            left: direction * Math.max(200, track.clientWidth * 0.8),
            behavior: 'smooth',
        });
    }

    updateEdges(): void {
        const track = this.track().nativeElement;
        this.canScrollLeft.set(track.scrollLeft > 4);
        this.canScrollRight.set(
            track.scrollLeft + track.clientWidth < track.scrollWidth - 4
        );
    }

    /** The focused card becomes the row's one tab stop. */
    onFocusIn(event: FocusEvent): void {
        const stops = this.stops();
        const index = stops.indexOf(event.target as HTMLElement);
        if (index >= 0) {
            stops.forEach((stop, i) => (stop.tabIndex = i === index ? 0 : -1));
        }
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
        }
        const stops = this.stops();
        const index = stops.indexOf(event.target as HTMLElement);
        if (index < 0) {
            return;
        }
        const last = stops.length - 1;
        const moves: Record<string, number> = {
            ArrowRight: Math.min(last, index + 1),
            ArrowLeft: Math.max(0, index - 1),
            Home: 0,
            End: last,
        };
        if (!(event.key in moves)) {
            return;
        }
        event.preventDefault();
        const next = stops[moves[event.key]];
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    private stops(): HTMLElement[] {
        return Array.from(
            this.track().nativeElement.querySelectorAll<HTMLElement>(
                ':scope > [data-stop]'
            )
        );
    }
}
