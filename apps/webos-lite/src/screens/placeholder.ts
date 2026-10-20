import { h } from '../core/dom';
import type { Page } from './shell';

/** A page still to come: its title under the bar. */
export class PlaceholderPage implements Page {
    readonly el: HTMLElement;

    constructor(title: string) {
        this.el = h('div', 'page', h('div', 'page__top'), h('h1', { className: 'heading__title status', text: title }));
    }

    show(): void {
        // Nothing to load.
    }

    hide(): void {
        // Nothing runs.
    }
}
