import { h, toggleClass } from '../core/dom';
import { registerRevealer, type Revealer } from '../core/nav';
import { Row } from './row';

/**
 * A tab's or a title's page: blocks and rows stacked vertically, scrolled
 * with a transform so the focused row sits at the top, under the bar
 * (`topPad`); in a block, the focused element only comes into view. Rows
 * within about a screen of the visible area render their cards; the others
 * hold none (and lazy rows start loading as they come near).
 */
const BOTTOM_PAD = 70;

/** What the page needs of a row: its element, and whether it renders. */
export interface PageRow {
    readonly el: HTMLElement;
    setNear(near: boolean): void;
}
const NEAR_MARGIN = 700;

function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number {
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== ancestor) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
    }
    return top;
}

export class VPage implements Revealer {
    readonly el: HTMLElement;
    readonly content: HTMLElement;
    private scrollY = 0;
    private rows: PageRow[] = [];
    private isScrolled = false;

    /**
     * `scrim`: once the page scrolls, its screen darkens the band under
     * the bar (the desktop's top scrim), so what passes under it never
     * fights with the tabs.
     */
    constructor(
        className: string,
        private readonly topPad = 150,
        private readonly scrim = true
    ) {
        this.content = h('div', 'vpage__content');
        this.el = h('div', `vpage ${className}`, this.content);
        registerRevealer(this.el, this);
    }

    add<T>(block: HTMLElement | Row<T>, into: HTMLElement = this.content): void {
        if (block instanceof Row) {
            this.rows.push(block);
            into.appendChild(block.el);
        } else {
            into.appendChild(block);
        }
    }

    /** Removes `rows` (a country's, a season's episodes) from the page. */
    removeRows(rows: readonly PageRow[]): void {
        for (const row of rows) {
            if (row.el.parentNode) {
                row.el.parentNode.removeChild(row.el);
            }
        }
        this.rows = this.rows.filter((row) => rows.indexOf(row) < 0);
    }

    reveal(el: HTMLElement): void {
        const height = this.el.offsetHeight || 1080;
        const max = Math.max(0, this.content.offsetHeight - height);
        let target: number;
        const row = this.rows.find((candidate) => candidate.el.contains(el));
        const anchor = this.anchorOf(el);
        if (anchor) {
            // A hero: the page goes back to show it whole.
            target = offsetWithin(anchor, this.content);
        } else if (row) {
            const top = offsetWithin(row.el, this.content);
            // A row that shows whole with the page at its top keeps it there,
            // so the page's title stays clear of the bar.
            target = top + row.el.offsetHeight + BOTTOM_PAD <= height ? 0 : top - this.topPad;
        } else {
            const top = offsetWithin(el, this.content);
            const bottom = top + el.offsetHeight;
            if (top - this.topPad < this.scrollY) {
                target = top - this.topPad;
            } else if (bottom + BOTTOM_PAD > this.scrollY + height) {
                target = bottom + BOTTOM_PAD - height;
            } else {
                target = this.scrollY;
            }
        }
        const next = Math.max(0, Math.min(max, target));
        if (next !== this.scrollY) {
            this.scrollTo(next);
        }
    }

    /** The hero (or a block marked data-anchor) that holds `el`, if any. */
    private anchorOf(el: HTMLElement): HTMLElement | null {
        let node: HTMLElement | null = el;
        while (node && node !== this.content) {
            if (node.hasAttribute('data-anchor') || node.classList.contains('hero')) {
                return node;
            }
            node = node.parentElement;
        }
        return null;
    }

    get scrolled(): number {
        return this.scrollY;
    }

    scrollTo(y: number): void {
        this.scrollY = y;
        this.content.style.transform = `translate3d(0, ${-y}px, 0)`;
        this.markScrolled(y > 4);
        this.updateNear();
    }

    private markScrolled(scrolled: boolean): void {
        if (!this.scrim || scrolled === this.isScrolled) {
            return;
        }
        this.isScrolled = scrolled;
        if (scrolled) {
            this.el.setAttribute('data-scrolled', '');
        } else {
            this.el.removeAttribute('data-scrolled');
        }
        let node = this.el.parentElement;
        while (node && !node.classList.contains('screen')) {
            node = node.parentElement;
        }
        if (node) {
            toggleClass(node, 'is-scrolled', scrolled);
        }
    }

    /** Renders the rows near the visible area, empties the others. */
    updateNear(): void {
        const height = this.el.offsetHeight || 1080;
        for (const row of this.rows) {
            const top = offsetWithin(row.el, this.content);
            const bottom = top + row.el.offsetHeight;
            row.setNear(
                top < this.scrollY + height + NEAR_MARGIN &&
                    bottom > this.scrollY - NEAR_MARGIN
            );
        }
    }
}
