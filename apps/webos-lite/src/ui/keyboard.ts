import { h } from '../core/dom';
import { onActivate } from '../core/nav';
import { icon } from './icons';

/**
 * Buscar's on-screen keyboard for the remote: letters (with ñ), digits,
 * space, delete and clear, seven keys across. OK types the focused key.
 */
const ROWS: readonly string[] = ['abcdefg', 'hijklmn', 'ñopqrst', "uvwxyz'", '1234567', '890'];

export interface KeyboardActions {
    readonly type: (text: string) => void;
    readonly erase: () => void;
    readonly clear: () => void;
}

export function keyboard(actions: KeyboardActions, clearLabel: string): HTMLElement {
    const el = h('div', 'keyboard');
    ROWS.forEach((row, index) => {
        const line = h('div', 'keyboard__row');
        for (const char of row.split('')) {
            line.appendChild(onActivate(h('div', { className: 'key', text: char.toUpperCase() }), () => actions.type(char)));
        }
        if (index === ROWS.length - 1) {
            line.appendChild(onActivate(h('div', 'key key--wide', icon('space')), () => actions.type(' ')));
            line.appendChild(onActivate(h('div', 'key key--wide', icon('backspace')), () => actions.erase()));
        }
        el.appendChild(line);
    });
    el.appendChild(
        h('div', 'keyboard__row', onActivate(h('div', { className: 'key key--clear', text: clearLabel }), () => actions.clear()))
    );
    return el;
}
