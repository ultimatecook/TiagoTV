import { clear, h } from '../core/dom';
import { onActivate } from '../core/nav';

/**
 * A page section that is not a row of cards (the Home's "Eventos de hoy",
 * "Series para ti"): the desktop's heading, then its own content.
 */
export class Block {
    readonly el: HTMLElement;
    readonly body = h('div', 'block__body');
    private readonly titleEl: HTMLElement;
    private readonly noteEl = h('span', 'heading__note');

    constructor(title: string, className = '') {
        this.titleEl = h('h2', { className: 'heading__title', text: title });
        this.el = h('section', `block ${className}`, h('div', 'heading', this.titleEl, this.noteEl), this.body);
    }

    setNote(text: string): void {
        this.noteEl.textContent = text;
    }

    /** Replaces the content (null leaves it empty). */
    fill(content: Node | null): void {
        clear(this.body);
        if (content) {
            this.body.appendChild(content);
        }
    }

    /** A line of text in place of the content ("Cargando…"), with "Reintentar" if it can. */
    say(text: string, retry?: () => void): void {
        const line = h('p', { className: 'status', text });
        if (retry) {
            line.appendChild(onActivate(h('span', { className: 'button button--small status__retry', text: 'Reintentar' }), retry));
        }
        this.fill(line);
    }

    show(visible: boolean): void {
        this.el.style.display = visible ? '' : 'none';
    }
}
