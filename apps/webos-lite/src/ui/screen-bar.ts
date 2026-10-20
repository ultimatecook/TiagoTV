import { nav, onActivate, registerGroup, type Group } from '../core/nav';
import { BAR_ITEMS, buildTopbar } from './topbar';

/**
 * The bar on a page opened over the tabs (a title's, a platform's, a
 * league's): focusable, as the shell's, so Up reaches it; left and right
 * move along it, and OK closes the page and opens that tab.
 */
export function screenBar(active: string | null, open: (id: string) => void): HTMLElement {
    const bar = buildTopbar(BAR_ITEMS, active, true);
    bar.items.forEach((el, index) => onActivate(el, () => open(BAR_ITEMS[index].id)));
    let last = bar.items[Math.max(0, BAR_ITEMS.findIndex((item) => item.id === active))];
    const group: Group = {
        el: bar.el,
        enter: () => last,
        move: (direction, from) => {
            if (direction === 'down') {
                return null;
            }
            if (direction === 'up') {
                return false;
            }
            const next = bar.items[bar.items.indexOf(from) + (direction === 'right' ? 1 : -1)];
            if (!next) {
                return false;
            }
            nav.focus(next);
            return true;
        },
        focused: (el) => {
            last = el;
        },
    };
    registerGroup(group);
    return bar.el;
}
