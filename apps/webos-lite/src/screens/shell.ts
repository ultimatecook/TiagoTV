import { h, toggleClass } from '../core/dom';
import type { Action, Direction } from '../core/keys';
import { nav, onActivate, registerGroup, type Group } from '../core/nav';
import type { Screen } from '../core/screens';
import { BAR_ITEMS, buildTopbar } from '../ui/topbar';

/**
 * The app's frame, as the desktop's: the top bar over the active page.
 * Left/right along the bar switch pages as their tab (or circle) takes
 * focus; down enters the page; Back inside a page returns to the bar, and
 * on the bar goes to Inicio, then asks to leave. Pages are made the first
 * time they open and kept, with their focus and scroll.
 */
export interface Page {
    readonly el: HTMLElement;
    show(): void;
    hide(): void;
    /** Where focus goes entering the page from the bar, if it matters. */
    focusTarget?(): HTMLElement | null;
    /** Keys the page handles itself (En vivo's CH+/CH-); true if handled. */
    onKey?(action: Action): boolean;
    /** Back inside the page, before the shell's: true if handled. */
    onBack?(): boolean;
}

export interface PageDefinition {
    readonly id: string;
    readonly create: () => Page;
}

class Bar implements Group {
    constructor(
        readonly el: HTMLElement,
        private readonly shell: ShellScreen
    ) {
        registerGroup(this);
    }

    enter(): HTMLElement | null {
        return this.shell.activeItem();
    }

    move(direction: Direction, from: HTMLElement): boolean | null {
        if (direction === 'down') {
            return null;
        }
        if (direction === 'up') {
            return false;
        }
        return this.shell.step(from, direction === 'right' ? 1 : -1);
    }
}

export class ShellScreen implements Screen {
    readonly el: HTMLElement;
    private readonly items: readonly HTMLElement[];
    private readonly pages: (Page | null)[];
    private readonly pagesEl = h('div', 'pages');
    private active = -1;

    constructor(
        private readonly definitions: readonly PageDefinition[],
        initial = 'home'
    ) {
        const bar = buildTopbar(BAR_ITEMS, null, true);
        this.items = bar.items;
        this.items.forEach((el, index) => onActivate(el, () => this.enterPage(index)));
        this.pages = BAR_ITEMS.map(() => null);
        this.el = h('div', 'screen shell room', this.pagesEl, h('div', 'shell__veil'), bar.el);
        new Bar(bar.el, this);
        this.select(this.indexOf(initial));
    }

    private indexOf(id: string): number {
        return Math.max(0, BAR_ITEMS.findIndex((item) => item.id === id));
    }

    activeItem(): HTMLElement {
        return this.items[this.active];
    }

    get activeId(): string {
        return BAR_ITEMS[this.active].id;
    }

    initialFocus(): HTMLElement | null {
        return this.activeItem();
    }

    /** Moves along the bar, showing each page as its item takes focus. */
    step(from: HTMLElement, delta: number): boolean {
        const next = this.items.indexOf(from) + delta;
        if (next < 0 || next >= this.items.length) {
            return false;
        }
        this.select(next);
        nav.focus(this.items[next]);
        return true;
    }

    private pageAt(index: number): Page {
        let page = this.pages[index];
        if (!page) {
            const definition = this.definitions.find((entry) => entry.id === BAR_ITEMS[index].id);
            if (!definition) {
                throw new Error(`No page ${BAR_ITEMS[index].id}`);
            }
            page = definition.create();
            this.pages[index] = page;
            this.pagesEl.appendChild(page.el);
        }
        return page;
    }

    select(index: number): void {
        if (index === this.active) {
            return;
        }
        const previous = this.active >= 0 ? this.pages[this.active] : null;
        if (previous) {
            previous.hide();
            previous.el.style.display = 'none';
        }
        if (this.active >= 0) {
            this.items[this.active].classList.remove('is-active');
        }
        this.active = index;
        this.items[index].classList.add('is-active');
        this.setBare(false);
        const page = this.pageAt(index);
        page.el.style.display = '';
        // The top scrim follows the page that shows (scrolled or not).
        toggleClass(this.el, 'is-scrolled', page.el.hasAttribute('data-scrolled') || !!page.el.querySelector('[data-scrolled]'));
        page.show();
    }

    /** Opens the page `id` and focuses inside it (a Home card's "Ver todo"). */
    open(id: string): void {
        this.enterPage(this.indexOf(id));
    }

    /** En vivo's idle picture: the bar and its veil step aside. */
    setBare(bare: boolean): void {
        toggleClass(this.el, 'shell--bare', bare);
    }

    private enterPage(index: number): void {
        this.select(index);
        const page = this.pages[index];
        const target = page?.focusTarget?.() ?? null;
        if (target) {
            nav.focus(target);
        } else {
            nav.move('down');
        }
    }

    private get page(): Page | null {
        return this.active >= 0 ? this.pages[this.active] : null;
    }

    private inBar(): boolean {
        const focused = nav.focused;
        return !!focused && this.items.indexOf(focused) >= 0;
    }

    onShow(): void {
        this.page?.show();
    }

    onHide(): void {
        this.page?.hide();
    }

    onKey(action: Action): boolean {
        const page = this.page;
        if (page && page.onKey && page.onKey(action)) {
            return true;
        }
        // Up with nothing above it on the page reaches the bar, wherever the
        // page's top row sits (En vivo's country chips are level with it).
        if (action === 'up' && !this.inBar()) {
            if (!nav.move('up')) {
                nav.focus(this.activeItem());
            }
            return true;
        }
        return false;
    }

    onBack(): boolean {
        const page = this.page;
        if (!this.inBar()) {
            if (page?.onBack?.()) {
                return true;
            }
            nav.focus(this.activeItem());
            return true;
        }
        if (this.active !== 0) {
            this.select(0);
            nav.focus(this.items[0]);
            return true;
        }
        return false;
    }
}
