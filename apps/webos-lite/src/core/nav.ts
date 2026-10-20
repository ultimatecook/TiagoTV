import { bestCandidate, type Candidate, type Rect } from './geometry';
import type { Direction } from './keys';

/**
 * Spatial navigation for the remote. Focus is virtual (a `focused` class,
 * not DOM focus), so the browser never scrolls a container on its own;
 * only text inputs also take DOM focus, for the on-screen keyboard.
 *
 * Focusable elements carry the `f` class. A group (a row of cards, the tab
 * bar) moves focus inside itself and is entered as a whole: arrow keys
 * between groups pick the nearest one on screen, and the group decides
 * which of its elements takes focus (the one focused last). Elsewhere the
 * nearest focusable in the arrow's direction wins.
 */
export interface Group {
    readonly el: HTMLElement;
    /** The element to focus on entering, nearest to `fromX` if it matters. */
    enter(fromX: number | null): HTMLElement | null;
    /** A move inside: true/false when handled, null to leave the group. */
    move(direction: Direction, from: HTMLElement): boolean | null;
    /** `el`, one of the group's, took focus. */
    focused?(el: HTMLElement, byPointer: boolean): void;
}

export interface Revealer {
    reveal(el: HTMLElement): void;
}

const groups = new WeakMap<Element, Group>();
const revealers = new WeakMap<Element, Revealer>();
const activations = new WeakMap<Element, () => void>();
const focusHooks = new WeakMap<Element, () => void>();

export function registerGroup(group: Group): void {
    group.el.setAttribute('data-group', '');
    groups.set(group.el, group);
}

export function registerRevealer(el: HTMLElement, revealer: Revealer): void {
    revealers.set(el, revealer);
}

/** Makes `el` focusable, running `run` on OK (or a pointer click). */
export function onActivate(el: HTMLElement, run: () => void): HTMLElement {
    el.classList.add('f');
    activations.set(el, run);
    return el;
}

export function onFocus(el: HTMLElement, run: () => void): void {
    focusHooks.set(el, run);
}

function isInput(el: Element): el is HTMLInputElement {
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}

function isShown(rect: Rect): boolean {
    return rect.width > 0 && rect.height > 0;
}

export class Nav {
    private current: HTMLElement | null = null;
    private root: HTMLElement | null = null;

    /** Created at import, before the DOM exists in tests: read lazily. */
    private get scope(): HTMLElement {
        return this.root ?? document.body;
    }

    get focused(): HTMLElement | null {
        return this.current;
    }

    setScope(scope: HTMLElement): void {
        this.root = scope;
    }

    groupOf(el: Element | null): Group | null {
        let node: Element | null = el;
        while (node && node !== this.scope.parentElement) {
            const group = groups.get(node);
            if (group) {
                return group;
            }
            node = node.parentElement;
        }
        return null;
    }

    focus(el: HTMLElement | null, byPointer = false): void {
        if (el === this.current) {
            return;
        }
        const previous = this.current;
        if (previous) {
            previous.classList.remove('focused');
            if (isInput(previous)) {
                previous.blur();
            }
        }
        this.current = el;
        if (!el) {
            return;
        }
        el.classList.add('focused');
        if (isInput(el)) {
            el.focus();
        }
        this.groupOf(el)?.focused?.(el, byPointer);
        if (!byPointer) {
            this.reveal(el);
        }
        focusHooks.get(el)?.();
    }

    /** Re-applies scroll for the focused element (after a re-layout). */
    reveal(el: HTMLElement): void {
        let node: HTMLElement | null = el;
        while (node) {
            revealers.get(node)?.reveal(el);
            node = node.parentElement;
        }
    }

    activate(): boolean {
        const run = this.current ? activations.get(this.current) : undefined;
        if (run) {
            run();
        }
        return !!run;
    }

    /** The first focusable of the scope, entering groups. */
    first(within: HTMLElement = this.scope): HTMLElement | null {
        const nodes = within.querySelectorAll('.f, [data-group]');
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i] as HTMLElement;
            if (!isShown(node.getBoundingClientRect())) {
                continue;
            }
            const group = groups.get(node);
            if (group) {
                const target = group.enter(null);
                if (target) {
                    return target;
                }
            } else if (!this.groupOf(node.parentElement)) {
                return node;
            }
        }
        return null;
    }

    move(direction: Direction): boolean {
        const current = this.current;
        if (!current || !this.scope.contains(current)) {
            const first = this.first();
            this.focus(first);
            return !!first;
        }
        const group = this.groupOf(current);
        if (group) {
            const handled = group.move(direction, current);
            if (handled !== null) {
                return handled;
            }
        }
        const from = current.getBoundingClientRect();
        let candidates = this.candidates(group);
        // A group with nothing to focus yet (a row still loading) is passed.
        for (let tries = 0; tries < 8; tries++) {
            const best = bestCandidate(from, candidates, direction);
            if (!best) {
                return false;
            }
            const target = groups.has(best)
                ? (groups.get(best) as Group).enter(from.left + from.width / 2)
                : best;
            if (target) {
                this.focus(target);
                return true;
            }
            candidates = candidates.filter((candidate) => candidate.item !== best);
        }
        return false;
    }

    private candidates(exclude: Group | null): Candidate<HTMLElement>[] {
        const nodes = this.scope.querySelectorAll('.f, [data-group]');
        const result: Candidate<HTMLElement>[] = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i] as HTMLElement;
            if (node === this.current || (exclude && node === exclude.el)) {
                continue;
            }
            // Only top-level focusables and groups: a group's own
            // elements are reached through the group.
            if (this.groupOf(node.parentElement)) {
                continue;
            }
            const rect = node.getBoundingClientRect();
            if (isShown(rect)) {
                result.push({ rect, item: node });
            }
        }
        return result;
    }
}

export const nav = new Nav();
