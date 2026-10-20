import type { StreamingPlatform } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h, picture, toggleClass } from '../core/dom';
import { queueImage } from '../core/image-queue';
import type { Direction } from '../core/keys';
import { nav, onActivate, registerGroup } from '../core/nav';
import { every, type Stop } from '../core/timers';
import { platformMark } from './cards';
import { icon, type IconName } from './icons';

/**
 * A hero, as the desktop's: the backdrop under the bar with its veils
 * (or a poster standing on the right of a tinted stage), an eyebrow, the
 * platform's logo, the title in Bebas, a meta line (and how far the
 * viewer got) and the buttons. With several slides it rotates every
 * ROTATE_MS while it shows and nothing in it has focus; left on the first
 * button and right on the last move between slides.
 */
export interface HeroAction {
    readonly label: string;
    readonly icon?: IconName;
    readonly primary?: boolean;
    readonly run: () => void;
}

/** Characters from which a hero's title is set smaller. */
const LONG_TITLE = 22;

export interface HeroSlide {
    readonly key: string;
    readonly eyebrow: string;
    readonly platform: StreamingPlatform | null;
    readonly title: string;
    readonly meta: string;
    readonly plot?: string | null;
    /** 0–1 watched. */
    readonly progress?: number;
    readonly backdrop: string | null;
    readonly keyart: string | null;
    readonly hue: number;
    readonly actions: readonly HeroAction[];
}

const ROTATE_MS = 8000;

export class Hero {
    readonly el: HTMLElement;
    private readonly stage = h('div', 'hero__stage');
    private readonly image = h('img', { className: 'hero__image', attrs: { alt: '' } });
    private readonly keyart = h('div', 'hero__keyart');
    private readonly content = h('div', 'hero__content');
    private readonly actionsEl = h('div', 'hero__actions');
    private readonly dots = h('div', 'hero__dots');
    private slides: readonly HeroSlide[] = [];
    private index = 0;
    private stopRotation: Stop | null = null;

    constructor(className = '', private readonly canRotate: () => boolean = () => true) {
        this.image.onload = () => this.image.classList.add('is-loaded');
        this.image.onerror = () => this.image.removeAttribute('src');
        this.stage.appendChild(this.image);
        this.stage.appendChild(this.keyart);
        this.stage.appendChild(h('div', 'hero__veil hero__veil--left'));
        this.stage.appendChild(h('div', 'hero__veil hero__veil--top'));
        this.el = h('section', `hero ${className}`, this.stage, this.content, this.dots);
        registerGroup({ el: this.actionsEl, enter: () => this.firstAction(), move: (d, from) => this.move(d, from) });
    }

    get current(): HeroSlide | null {
        return this.slides[this.index] ?? null;
    }

    /** The buttons' group: left/right past them change the slide. */
    move(direction: Direction, from: HTMLElement): boolean | null {
        if (direction === 'up' || direction === 'down') {
            return null;
        }
        const buttons = this.buttons();
        const at = buttons.indexOf(from);
        const next = at + (direction === 'right' ? 1 : -1);
        if (next >= 0 && next < buttons.length) {
            nav.focus(buttons[next]);
            return true;
        }
        if (this.slides.length < 2) {
            return false;
        }
        this.show(this.index + (direction === 'right' ? 1 : -1));
        nav.focus(direction === 'right' ? this.firstAction() : this.lastAction());
        return true;
    }

    private buttons(): HTMLElement[] {
        const list: HTMLElement[] = [];
        for (let i = 0; i < this.actionsEl.children.length; i++) {
            list.push(this.actionsEl.children[i] as HTMLElement);
        }
        return list;
    }

    firstAction(): HTMLElement | null {
        return this.buttons()[0] ?? null;
    }

    private lastAction(): HTMLElement | null {
        const buttons = this.buttons();
        return buttons[buttons.length - 1] ?? null;
    }

    setSlides(slides: readonly HeroSlide[]): void {
        const key = this.current ? this.current.key : null;
        this.slides = slides;
        const keep = slides.findIndex((slide) => slide.key === key);
        this.show(keep >= 0 ? keep : 0);
    }

    show(index: number): void {
        const count = this.slides.length;
        if (count === 0) {
            this.el.style.display = 'none';
            return;
        }
        this.el.style.display = '';
        const hadFocus = !!nav.focused && this.actionsEl.contains(nav.focused);
        this.index = ((index % count) + count) % count;
        const slide = this.slides[this.index];
        this.renderStage(slide);
        this.renderContent(slide);
        this.renderDots();
        if (hadFocus) {
            nav.focus(this.firstAction());
        }
    }

    private renderStage(slide: HeroSlide): void {
        this.stage.style.background =
            `radial-gradient(90% 110% at 72% 30%, hsl(${slide.hue},30%,34%) 0%, hsl(${slide.hue},30%,14%) 45%, #0b0b0a 85%)`;
        const wanted = slide.backdrop ?? '';
        if (this.image.getAttribute('data-src') !== wanted) {
            this.image.setAttribute('data-src', wanted);
            this.image.classList.remove('is-loaded');
            this.image.removeAttribute('src');
            if (slide.backdrop) {
                queueImage(this.image, slide.backdrop);
            }
        }
        clear(this.keyart);
        if (!slide.backdrop && slide.keyart) {
            this.keyart.appendChild(picture(slide.keyart, 'hero__poster', ''));
        }
    }

    private renderContent(slide: HeroSlide): void {
        clear(this.content);
        const progress = slide.progress && slide.progress > 0 ? Math.min(1, slide.progress) : 0;
        const bar = progress > 0 ? h('span', 'hero__progress', h('i')) : null;
        if (bar) {
            (bar.firstChild as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
        }
        if (slide.eyebrow) {
            this.content.appendChild(h('p', { className: 'hero__eyebrow', text: slide.eyebrow }));
        }
        const mark = platformMark(slide.platform, 'hero__platform');
        if (mark) {
            this.content.appendChild(mark);
        }
        // A long name ("JO KOY: LIVE FROM THE LOS ANGELES FORUM") is set smaller.
        const long = slide.title.length > LONG_TITLE ? ' is-long' : '';
        this.content.appendChild(h('h2', { className: `hero__title display${long}`, text: slide.title }));
        if (bar || slide.meta) {
            this.content.appendChild(h('div', 'hero__meta', bar, slide.meta ? h('span', { text: slide.meta }) : null));
        }
        if (slide.plot) {
            this.content.appendChild(h('p', { className: 'hero__plot', text: slide.plot }));
        }
        clear(this.actionsEl);
        for (const action of slide.actions) {
            const button = h(
                'div',
                `button${action.primary ? ' button--primary' : ''}`,
                action.icon ? icon(action.icon) : null,
                action.label
            );
            this.actionsEl.appendChild(onActivate(button, action.run));
        }
        this.content.appendChild(this.actionsEl);
    }

    private renderDots(): void {
        clear(this.dots);
        if (this.slides.length < 2) {
            return;
        }
        this.slides.forEach((_, index) => {
            const dot = h('i', 'hero__dot');
            toggleClass(dot, 'is-active', index === this.index);
            this.dots.appendChild(dot);
        });
    }

    /** Rotates while the page shows (stopped when it hides). */
    start(): void {
        this.stop();
        if (this.slides.length < 2) {
            return;
        }
        this.stopRotation = every('hero-rotate', ROTATE_MS, () => {
            const focused = nav.focused;
            if (this.canRotate() && !(focused && this.el.contains(focused))) {
                this.show(this.index + 1);
            }
        });
    }

    stop(): void {
        if (this.stopRotation) {
            this.stopRotation();
            this.stopRotation = null;
        }
    }
}
