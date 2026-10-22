import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    Injector,
    input,
    linkedSignal,
    output,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { TvCard } from '../country-tv-categories';
import { CountryTvFavorites } from '../country-tv-favorites';
import { CountryTvListings } from '../country-tv-listings';
import {
    cardsWindow,
    revealScroll,
    type RowGeometry,
} from '../country-tv-window';

/**
 * "En vivo"'s row of channel cards: glass cards with the channel's logo
 * (its name in Bebas when no logo loads), name, what it shows now and how
 * far in, "REPRODUCIENDO" on the playing one and "FÚTBOL" on those
 * showing football now. A card plays its channel in place; its heart (on
 * hover, or always once saved) puts the channel on Mi lista. The row is
 * one tab stop: the arrows, Page Up/Down, Home and End move along it,
 * Enter plays, L saves. It renders the cards near its view only
 * (`cardsWindow`).
 */
@Component({
    selector: 'lib-country-tv-cards',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './country-tv-cards.component.html',
    styleUrl: './country-tv-cards.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '(keydown)': 'onKeydown($event)' },
})
export class CountryTvCardsComponent {
    readonly cards = input.required<readonly TvCard[]>();
    /** The stream on the player, to mark its card. */
    readonly playingStreamId = input<number | null>(null);
    /** Whether that stream is on: an idle pick keeps the tab stop only. */
    readonly playing = input(true);
    /** The row's accessible name. */
    readonly label = input('');
    readonly picked = output<TvCard>();
    /** A card's heart, or L on a card. */
    readonly favoriteToggled = output<TvCard>();

    private readonly listings = inject(CountryTvListings);
    private readonly favorites = inject(CountryTvFavorites);
    private readonly injector = inject(Injector);
    private readonly track =
        viewChild.required<ElementRef<HTMLElement>>('track');
    private readonly failedLogos = signal<ReadonlySet<string>>(new Set());
    private readonly geometry = signal<RowGeometry>({
        scrollLeft: 0,
        width: 1600,
        padding: 56,
        pitch: 212,
    });
    private frame = 0;

    readonly window = computed(
        () => cardsWindow(this.geometry(), this.cards().length),
        { equal: (a, b) => a.start === b.start && a.end === b.end }
    );
    readonly playingIndex = computed(() => {
        const streamId = this.playingStreamId();
        return streamId === null
            ? -1
            : this.cards().findIndex((card) =>
                  card.channel.copies.some((copy) => copy.streamId === streamId)
              );
    });
    /** The card the row's tab stop rests on: the playing one, else the first. */
    readonly resting = linkedSignal({
        source: () => ({ cards: this.cards(), playing: this.playingIndex() }),
        computation: ({ playing }) => Math.max(0, playing),
    });
    readonly restingShown = computed(() => {
        const { start, end } = this.window();
        return this.resting() >= start && this.resting() < end;
    });
    /** The room of the cards not rendered, before and after the window. */
    readonly before = computed(
        () => this.window().start * this.geometry().pitch
    );
    readonly after = computed(
        () => (this.cards().length - this.window().end) * this.geometry().pitch
    );
    readonly shown = computed(() => {
        const { start, end } = this.window();
        const playing = this.playingIndex();
        const failed = this.failedLogos();
        return this.cards()
            .slice(start, end)
            .map((card, offset) => {
                const { channel } = card;
                const now = this.listings.nowOn(channel);
                return {
                    card,
                    index: start + offset,
                    on: start + offset === playing && this.playing(),
                    logo:
                        channel.icons.find((icon) => !failed.has(icon)) ?? null,
                    hue: hueOf(channel.title),
                    saved: this.favorites.isSaved(channel),
                    now,
                    progress: now?.progress ?? null,
                };
            });
    });

    constructor() {
        const destroyRef = inject(DestroyRef);
        // A new list (a country, a chip): back to its start, or to the
        // playing card, a third of the way in.
        effect(() => {
            this.cards();
            untracked(() =>
                afterNextRender(() => this.revealPlaying(), {
                    injector: this.injector,
                })
            );
        });
        // Outside Angular's listeners: a scroll re-renders only when the
        // window of rendered cards moves.
        afterNextRender(() => {
            const track = this.track().nativeElement;
            const onScroll = () => {
                cancelAnimationFrame(this.frame);
                this.frame = requestAnimationFrame(() => this.measure());
            };
            track.addEventListener('scroll', onScroll, { passive: true });
            const observer =
                typeof ResizeObserver === 'undefined'
                    ? null
                    : new ResizeObserver(() => this.measure());
            observer?.observe(track);
            destroyRef.onDestroy(() => {
                track.removeEventListener('scroll', onScroll);
                observer?.disconnect();
                cancelAnimationFrame(this.frame);
            });
            this.measure();
        });
    }

    pick(card: TvCard, index: number): void {
        this.resting.set(index);
        this.picked.emit(card);
    }

    logoFailed(url: string): void {
        this.failedLogos.update((failed) => new Set(failed).add(url));
    }

    /** The row's tab stop, when its card is scrolled away: back to it. */
    onTrackFocus(event: FocusEvent): void {
        if (event.target === this.track().nativeElement) {
            this.focusCard(this.resting());
        }
    }

    /** The playing card (else the first) takes focus: the page's arrows. */
    focusPlaying(): void {
        this.focusCard(this.resting());
    }

    onKeydown(event: KeyboardEvent): void {
        const index = Number(
            (event.target as HTMLElement | null)?.dataset?.['card'] ?? NaN
        );
        if (
            !Number.isInteger(index) ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
        ) {
            return;
        }
        // The focused card's channel, not the stage's (the page's L).
        if (event.key === 'l' || event.key === 'L') {
            event.preventDefault();
            this.favoriteToggled.emit(this.cards()[index]);
            return;
        }
        const last = this.cards().length - 1;
        const page = Math.max(
            1,
            Math.floor(this.geometry().width / this.geometry().pitch) - 1
        );
        const moves: Record<string, number> = {
            ArrowRight: Math.min(last, index + 1),
            ArrowLeft: Math.max(0, index - 1),
            PageDown: Math.min(last, index + page),
            PageUp: Math.max(0, index - page),
            Home: 0,
            End: last,
        };
        if (event.key in moves) {
            event.preventDefault();
            event.stopPropagation();
            this.focusCard(moves[event.key]);
        }
    }

    private focusCard(index: number): void {
        if (index < 0 || index >= this.cards().length) {
            return;
        }
        this.resting.set(index);
        this.scrollTo(revealScroll(this.read(), index, 'nearest'));
        afterNextRender(
            () =>
                this.cardElement(index)?.focus({
                    preventScroll: true,
                }),
            { injector: this.injector }
        );
    }

    private revealPlaying(): void {
        const playing = this.playingIndex();
        const start = { ...this.read(), scrollLeft: 0 };
        this.scrollTo(
            playing < 0 ? 0 : (revealScroll(start, playing, 'third') ?? 0)
        );
    }

    /**
     * The window follows where the row is sent, not where it reads back:
     * a card's room is rendered before its first frame.
     */
    private scrollTo(left: number | null): void {
        const geometry = this.read();
        if (left === null) {
            this.geometry.set(geometry);
            return;
        }
        this.track().nativeElement.scrollLeft = left;
        this.geometry.set({ ...geometry, scrollLeft: left });
    }

    private measure(): void {
        this.geometry.set(this.read());
    }

    private read(): RowGeometry {
        const track = this.track().nativeElement;
        const style = getComputedStyle(track);
        const px = (name: string, fallback: number) =>
            parseFloat(style.getPropertyValue(name)) || fallback;
        return {
            scrollLeft: track.scrollLeft,
            width: track.clientWidth || 1600,
            padding: px('--row-pad', 56),
            pitch: px('--card-w', 196) + px('--card-gap', 16),
        };
    }

    private cardElement(index: number): HTMLElement | null {
        return this.track().nativeElement.querySelector<HTMLElement>(
            `[data-card="${index}"]`
        );
    }
}

/** A steady hue per channel, for the plate behind its name. */
export function hueOf(title: string): number {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = (hash * 31 + title.charCodeAt(i)) % 360;
    }
    return hash;
}
