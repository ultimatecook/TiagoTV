import { detach, h, releaseImages } from '../core/dom';
import { renderWindow, rowScroll, type RowMetrics } from '../core/geometry';
import type { Direction } from '../core/keys';
import { nav, onActivate, registerGroup, type Group } from '../core/nav';

/**
 * A horizontal row of cards for the remote. Cards have one width per row,
 * so positions are computed, never measured, and only the window around
 * the focused card exists in the DOM (about 14 cards, whatever the row's
 * length); a row far from the screen holds none. The row remembers its
 * focused card for when focus comes back.
 */
export const ROW_VIEWPORT = 1760;

/** The kind of cards: it sets the row's height in rows.css. */
export type RowVariant = string;

export interface RowConfig<T> {
    readonly title: string;
    readonly variant: RowVariant;
    readonly cardWidth: number;
    readonly gap: number;
    readonly render: (item: T, index: number) => HTMLElement;
    readonly activate: (item: T, index: number) => void;
    readonly onFocusItem?: (item: T, index: number) => void;
    /** Runs once, the first time the row comes near the screen. */
    readonly onNear?: () => void;
    readonly logo?: string | null;
    /** No heading (a row under a block that names it). */
    readonly headless?: boolean;
}

export class Row<T> implements Group {
    readonly el: HTMLElement;
    private readonly titleEl: HTMLElement;
    private readonly noteEl: HTMLElement;
    private readonly track: HTMLElement;
    private items: readonly T[] = [];
    private statusCard: HTMLElement | null = null;
    private readonly cards = new Map<number, HTMLElement>();
    private index = 0;
    private scroll = 0;
    private near = false;
    private nearCalled = false;

    constructor(private readonly config: RowConfig<T>) {
        this.titleEl = h('h2', { className: 'heading__title', text: config.title });
        this.noteEl = h('span', 'heading__note');
        const head = config.headless
            ? null
            : h(
                  'div',
                  'heading row__head',
                  config.logo
                      ? h('img', { className: 'row__logo', attrs: { src: config.logo, alt: '' } })
                      : null,
                  this.titleEl,
                  this.noteEl
              );
        this.track = h('div', 'row__track');
        this.el = h(
            'section',
            `row row--${config.variant}`,
            head,
            h('div', 'row__viewport', this.track)
        );
        registerGroup(this);
    }

    get length(): number {
        return this.items.length;
    }

    get focusedIndex(): number {
        return this.index;
    }

    get itemList(): readonly T[] {
        return this.items;
    }

    private get metrics(): RowMetrics {
        return {
            count: this.items.length,
            pitch: this.config.cardWidth + this.config.gap,
            viewport: ROW_VIEWPORT,
        };
    }

    setTitle(text: string): void {
        this.titleEl.textContent = text;
    }

    setNote(text: string): void {
        this.noteEl.textContent = text;
    }

    private hasFocus(): boolean {
        return !!nav.focused && this.el.contains(nav.focused);
    }

    setItems(items: readonly T[], keepIndex = false): void {
        if (keepIndex && !this.statusCard && this.same(items)) {
            // Nothing changed: the cards (and the focused one) stay.
            return;
        }
        const hadFocus = this.hasFocus();
        this.removeStatus();
        this.clearCards();
        this.items = items;
        if (!keepIndex) {
            this.index = 0;
        }
        this.index = Math.max(0, Math.min(this.index, items.length - 1));
        this.scroll = rowScroll(this.index, this.metrics);
        this.layout();
        if (hadFocus) {
            nav.focus(this.enter());
        }
    }

    private same(items: readonly T[]): boolean {
        if (items.length !== this.items.length) {
            return false;
        }
        for (let i = 0; i < items.length; i++) {
            if (items[i] !== this.items[i]) {
                return false;
            }
        }
        return true;
    }

    /** A card in place of the items: "Cargando…", an error (OK retries). */
    setStatus(text: string, retry?: () => void): void {
        const hadFocus = this.hasFocus();
        this.clearCards();
        this.items = [];
        this.removeStatus();
        const card = h('div', 'card card--status', h('span', { text }));
        onActivate(card, () => retry?.());
        if (retry) {
            card.classList.add('card--retry');
        }
        this.statusCard = card;
        this.track.appendChild(card);
        this.track.style.transform = '';
        if (hadFocus) {
            nav.focus(card);
        }
    }

    setNear(near: boolean): void {
        if (near && !this.nearCalled) {
            this.nearCalled = true;
            this.config.onNear?.();
        }
        if (near === this.near) {
            return;
        }
        this.near = near;
        if (!near) {
            this.clearCards();
        }
        this.layout();
    }

    enter(): HTMLElement | null {
        if (this.statusCard) {
            return this.statusCard;
        }
        if (this.items.length === 0) {
            return null;
        }
        this.setNear(true);
        return this.cardAt(this.index);
    }

    move(direction: Direction): boolean | null {
        if (direction === 'up' || direction === 'down') {
            return null;
        }
        if (this.statusCard) {
            return false;
        }
        const next = this.index + (direction === 'right' ? 1 : -1);
        if (next < 0 || next >= this.items.length) {
            return false;
        }
        nav.focus(this.cardAt(next));
        return true;
    }

    focused(el: HTMLElement, byPointer: boolean): void {
        const index = Number(el.getAttribute('data-i'));
        if (!Number.isFinite(index) || el === this.statusCard) {
            return;
        }
        this.index = index;
        if (byPointer) {
            const left = index * this.metrics.pitch - this.scroll;
            if (left < 0 || left + this.config.cardWidth > ROW_VIEWPORT) {
                this.scroll = rowScroll(index, this.metrics);
                this.layout();
            }
        }
        this.config.onFocusItem?.(this.items[index], index);
    }

    /** Runs `update` on the cards in the DOM (a state shown by a class). */
    eachCard(update: (card: HTMLElement, item: T, index: number) => void): void {
        this.cards.forEach((card, index) => update(card, this.items[index], index));
    }

    /** Focuses item `index` (the player zapped to it, say). */
    cardAt(index: number): HTMLElement | null {
        this.index = Math.max(0, Math.min(index, this.items.length - 1));
        this.scroll = rowScroll(this.index, this.metrics);
        if (this.near) {
            this.layout();
        } else {
            this.setNear(true);
        }
        return this.cards.get(this.index) ?? null;
    }

    private layout(): void {
        if (this.statusCard || !this.near) {
            return;
        }
        const { pitch } = this.metrics;
        const { start, end } = renderWindow(this.scroll, this.metrics);
        this.cards.forEach((card, index) => {
            if (index < start || index >= end) {
                this.dropCard(index, card);
            }
        });
        for (let index = start; index < end; index++) {
            if (!this.cards.has(index)) {
                const item = this.items[index];
                const card = this.config.render(item, index);
                card.classList.add('card');
                card.setAttribute('data-i', String(index));
                card.style.left = `${index * pitch}px`;
                onActivate(card, () => this.config.activate(item, index));
                this.cards.set(index, card);
                this.track.appendChild(card);
            }
        }
        this.track.style.transform = `translate3d(${-this.scroll}px, 0, 0)`;
    }

    private dropCard(index: number, card: HTMLElement): void {
        if (nav.focused === card) {
            return;
        }
        releaseImages(card);
        detach(card);
        this.cards.delete(index);
    }

    private clearCards(): void {
        this.cards.forEach((card) => {
            releaseImages(card);
            detach(card);
        });
        this.cards.clear();
    }

    private removeStatus(): void {
        detach(this.statusCard);
        this.statusCard = null;
    }
}
