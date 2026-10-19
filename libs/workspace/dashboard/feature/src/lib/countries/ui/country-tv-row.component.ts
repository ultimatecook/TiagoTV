import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    Injector,
    input,
    linkedSignal,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { CountryChannelGroup } from '../country-channels';
import type { TvRow } from '../country-rows';
import { NearViewportDirective } from './near-viewport.directive';

/** Tiles a long row shows before "See all". */
export const ROW_CAP = 30;
/** A row only this much longer shows whole. */
const ROW_SLACK = 6;
const PLACEHOLDERS = [1, 2, 3, 4, 5, 6, 7, 8];

let nextId = 0;

/** Up or down out of a row, from a tile centred at `x` (px). */
export interface RowCrossing {
    readonly direction: 1 | -1;
    readonly x: number;
}

/**
 * One row of "Por países": its name, then its channels sideways, a logo
 * tile each (the name on the tile when no logo loads). A tile plays its
 * channel in the page's player. The row is one tab stop: the arrows move
 * along it (up and down to the next rows, through the page), Home and End
 * jump to its ends. Its tiles render once it comes near the view; a long
 * row ends on a "See all" tile that shows the rest.
 */
@Component({
    selector: 'lib-country-tv-row',
    imports: [MatIcon, NearViewportDirective, TranslatePipe],
    templateUrl: './country-tv-row.component.html',
    styleUrl: './country-tv-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    // The tiles' keys; a key from elsewhere in the row is let through.
    host: { '(keydown)': 'onKeydown($event)' },
})
export class CountryTvRowComponent {
    readonly row = input.required<TvRow>();
    /** The stream on the page's player, to mark its tile. */
    readonly playingStreamId = input<number | null>(null);
    /** Whether it plays in the page (its tile says "Live"). */
    readonly live = input(false);
    readonly picked = output<CountryChannelGroup>();
    readonly crossed = output<RowCrossing>();

    private readonly injector = inject(Injector);
    private readonly host: HTMLElement = inject(ElementRef).nativeElement;
    private readonly track = viewChild<ElementRef<HTMLElement>>('track');
    readonly titleId = `country-tv-row-${nextId++}`;
    readonly placeholders = PLACEHOLDERS;

    readonly rendered = signal(false);
    /** "See all" was pressed (kept while the catalog refreshes the row). */
    readonly expanded = linkedSignal({
        source: () => this.row().id,
        computation: () => false,
    });
    readonly shown = computed(() => {
        const channels = this.row().channels;
        return this.expanded() || channels.length <= ROW_CAP + ROW_SLACK
            ? channels
            : channels.slice(0, ROW_CAP);
    });
    readonly hidden = computed(
        () => this.row().channels.length - this.shown().length
    );
    readonly playingIndex = computed(() => {
        const streamId = this.playingStreamId();
        return streamId === null
            ? -1
            : this.shown().findIndex((channel) =>
                  channel.copies.some((copy) => copy.streamId === streamId)
              );
    });
    /** The tile the row's tab stop rests on: the playing one, else the first. */
    readonly resting = linkedSignal(() => Math.max(0, this.playingIndex()));
    private readonly stops = computed(
        () => this.shown().length + (this.hidden() > 0 ? 1 : 0)
    );
    private readonly failedLogos = signal<ReadonlySet<string>>(new Set());
    readonly canScrollLeft = signal(false);
    readonly canScrollRight = signal(false);

    logoOf(channel: CountryChannelGroup): string | null {
        const failed = this.failedLogos();
        return channel.icons.find((icon) => !failed.has(icon)) ?? null;
    }

    logoFailed(url: string): void {
        this.failedLogos.update((failed) => new Set(failed).add(url));
    }

    pick(channel: CountryChannelGroup, index: number): void {
        this.resting.set(index);
        this.picked.emit(channel);
    }

    expand(): void {
        const first = this.shown().length;
        this.expanded.set(true);
        this.afterRender(() => this.focusStop(first));
    }

    render(): void {
        if (this.rendered()) {
            return;
        }
        this.rendered.set(true);
        this.afterRender(() => {
            this.revealPlaying();
            this.updateEdges();
        });
    }

    onKeydown(event: KeyboardEvent): void {
        const stop = Number(
            (event.target as HTMLElement | null)?.dataset?.['stop'] ?? NaN
        );
        if (!Number.isInteger(stop) || event.altKey || event.ctrlKey) {
            return;
        }
        const last = this.stops() - 1;
        const moves: Record<string, number> = {
            ArrowRight: Math.min(last, stop + 1),
            ArrowLeft: Math.max(0, stop - 1),
            Home: 0,
            End: last,
        };
        if (event.key in moves) {
            this.focusStop(moves[event.key]);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const box = (event.target as HTMLElement).getBoundingClientRect();
            this.crossed.emit({
                direction: event.key === 'ArrowDown' ? 1 : -1,
                x: box.left + box.width / 2,
            });
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    /** From the row above or below: the tile nearest `x` takes focus. */
    focusNear(x: number): void {
        this.rendered.set(true);
        this.afterRender(() => {
            const tiles = this.tiles();
            let best = this.resting();
            let distance = Infinity;
            tiles.forEach((tile, index) => {
                const box = tile.getBoundingClientRect();
                const gap = Math.abs(box.left + box.width / 2 - x);
                if (gap < distance) {
                    distance = gap;
                    best = index;
                }
            });
            this.focusStop(best);
        });
    }

    scrollBy(direction: 1 | -1): void {
        const track = this.track()?.nativeElement;
        track?.scrollBy({
            left: direction * Math.max(200, track.clientWidth * 0.8),
            behavior: 'smooth',
        });
    }

    updateEdges(): void {
        const track = this.track()?.nativeElement;
        if (!track) {
            return;
        }
        this.canScrollLeft.set(track.scrollLeft > 4);
        this.canScrollRight.set(
            track.scrollLeft + track.clientWidth < track.scrollWidth - 4
        );
    }

    /** A row opening on the playing tile scrolls to it (sideways only). */
    private revealPlaying(): void {
        const track = this.track()?.nativeElement;
        const tile = this.tiles()[this.playingIndex()];
        if (track && tile && tile.offsetLeft > track.clientWidth * 0.7) {
            track.scrollLeft = tile.offsetLeft - track.clientWidth / 3;
        }
    }

    private focusStop(index: number): void {
        this.resting.set(index);
        const tile = this.tiles()[index];
        if (tile) {
            tile.focus({ preventScroll: true });
            tile.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    private tiles(): HTMLElement[] {
        return Array.from(
            this.host.querySelectorAll<HTMLElement>('[data-stop]')
        );
    }

    private afterRender(callback: () => void): void {
        afterNextRender(callback, { injector: this.injector });
    }
}
