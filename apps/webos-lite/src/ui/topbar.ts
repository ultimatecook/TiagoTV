import { h } from '../core/dom';
import { icon, type IconName } from './icons';

/**
 * The desktop's top bar: the red TiagoTV wordmark on the left, the dark
 * glass capsule of tabs in the middle (Inicio · Deportes · Series ·
 * Películas · En vivo · Mi lista), Buscar and Ajustes as glass circles on
 * the right. The shell's bar is focusable; the copy on a title's or a
 * platform's page only shows where the viewer is.
 */
export interface BarItem {
    readonly id: string;
    readonly label: string;
    /** An icon button on the right instead of a tab. */
    readonly icon?: IconName;
}

export interface Topbar {
    readonly el: HTMLElement;
    /** The tabs, then the icon buttons, in `items`' order. */
    readonly items: readonly HTMLElement[];
    readonly capsule: HTMLElement;
}

export function buildTopbar(items: readonly BarItem[], active: string | null, focusable: boolean): Topbar {
    const capsule = h('nav', 'capsule');
    const right = h('div', 'topbar__right');
    const els = items.map((item) => {
        const el = item.icon
            ? h('div', { className: 'circle', attrs: { 'data-tab': item.id, 'aria-label': item.label } }, icon(item.icon))
            : h('div', { className: 'tab', text: item.label, attrs: { 'data-tab': item.id } });
        if (item.id === active) {
            el.classList.add('is-active');
        }
        if (focusable) {
            el.classList.add('f');
        }
        (item.icon ? right : capsule).appendChild(el);
        return el;
    });
    const el = h(
        'header',
        'topbar',
        h('div', { className: 'brand topbar__logo', text: 'TiagoTV' }),
        h('div', 'topbar__middle', capsule),
        right
    );
    return { el, items: els, capsule };
}

/** The bar's items as the app shows them, in the desktop's order. */
export const BAR_ITEMS: readonly BarItem[] = [
    { id: 'home', label: 'Inicio' },
    { id: 'sports', label: 'Deportes' },
    { id: 'series', label: 'Series' },
    { id: 'movies', label: 'Películas' },
    { id: 'live', label: 'En vivo' },
    { id: 'mylist', label: 'Mi lista' },
    { id: 'search', label: 'Buscar', icon: 'search' },
    { id: 'settings', label: 'Ajustes', icon: 'settings' },
];
