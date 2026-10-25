import { h } from '../core/dom';
import { onActivate } from '../core/nav';
import type { Screen, ScreenStack } from '../core/screens';

/** A question over the current screen, answered with the remote. */
export interface DialogOptions {
    readonly title: string;
    readonly text?: string;
    readonly confirm: string;
    readonly cancel: string;
    readonly onConfirm: () => void;
}

export function confirmDialog(stack: ScreenStack, options: DialogOptions): Screen {
    const cancel = h('div', { className: 'button', text: options.cancel });
    const confirm = h('div', { className: 'button button--primary', text: options.confirm });
    onActivate(cancel, () => stack.pop());
    onActivate(confirm, () => {
        stack.pop();
        options.onConfirm();
    });
    const el = h(
        'div',
        'dialog',
        h(
            'div',
            'dialog__panel',
            h('h2', { className: 'dialog__title', text: options.title }),
            options.text ? h('p', { className: 'dialog__text', text: options.text }) : null,
            h('div', 'dialog__actions', confirm, cancel)
        )
    );
    return {
        el,
        overlay: true,
        initialFocus: () => cancel,
    };
}
