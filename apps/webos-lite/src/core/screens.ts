import { detach } from './dom';
import type { Action } from './keys';
import { nav } from './nav';

/**
 * The screens Back walks through: the Home (tabs), a title's page, the
 * player, a dialog on top. Covered screens stay in the DOM, hidden, so
 * they come back as they were, with their focus.
 */
export interface Screen {
    readonly el: HTMLElement;
    /** Dialogs leave the screen below them visible. */
    readonly overlay?: boolean;
    /** The element to focus when the screen opens (or its focus is gone). */
    initialFocus(): HTMLElement | null;
    /** Keys the screen handles itself (the player's); true if handled. */
    onKey?(action: Action): boolean;
    /** Back: true if the screen handled it (closing a panel of its own). */
    onBack?(): boolean;
    onShow?(): void;
    onHide?(): void;
    destroy?(): void;
}

interface Entry {
    readonly screen: Screen;
    lastFocus: HTMLElement | null;
}

export class ScreenStack {
    private readonly entries: Entry[] = [];
    /** Runs after every push and pop (main.ts keeps the activity true). */
    onChange: (() => void) | null = null;

    constructor(
        private readonly root: HTMLElement,
        private readonly onRootBack: () => void
    ) {}

    get top(): Screen | null {
        const entry = this.entries[this.entries.length - 1];
        return entry ? entry.screen : null;
    }

    get depth(): number {
        return this.entries.length;
    }

    push(screen: Screen): void {
        const below = this.entries[this.entries.length - 1];
        if (below) {
            below.lastFocus = nav.focused;
            if (!screen.overlay) {
                below.screen.el.style.display = 'none';
            }
            below.screen.onHide?.();
        }
        this.entries.push({ screen, lastFocus: null });
        this.root.appendChild(screen.el);
        this.enter(screen, null);
        this.onChange?.();
    }

    pop(): void {
        const entry = this.entries.pop();
        if (!entry) {
            return;
        }
        entry.screen.onHide?.();
        entry.screen.destroy?.();
        detach(entry.screen.el);
        const below = this.entries[this.entries.length - 1];
        if (below) {
            below.screen.el.style.display = '';
            this.enter(below.screen, below.lastFocus);
        }
        this.onChange?.();
    }

    /**
     * Where focus lands when the top screen closes: the channel the player
     * zapped to, not the one it opened with.
     */
    setReturnFocus(el: HTMLElement | null): void {
        const below = this.entries[this.entries.length - 2];
        if (below && el) {
            below.lastFocus = el;
        }
    }

    /** Closes every screen and opens `screen` alone. */
    reset(screen: Screen): void {
        while (this.entries.length > 0) {
            this.pop();
        }
        this.push(screen);
    }

    back(): void {
        const top = this.top;
        if (!top || top.onBack?.()) {
            return;
        }
        if (this.entries.length > 1) {
            this.pop();
        } else {
            this.onRootBack();
        }
    }

    private enter(screen: Screen, lastFocus: HTMLElement | null): void {
        nav.setScope(screen.el);
        screen.onShow?.();
        const target =
            lastFocus && screen.el.contains(lastFocus)
                ? lastFocus
                : screen.initialFocus();
        nav.focus(null);
        nav.focus(target ?? nav.first());
    }
}
