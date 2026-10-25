import type { PlatformTitle, StreamingPlatform } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h, toggleClass } from '../core/dom';
import { cancelImage, queueImage } from '../core/image-queue';
import type { Direction } from '../core/keys';
import { nav, onActivate, registerGroup } from '../core/nav';
import { every, type Stop } from '../core/timers';
import { tmdbSized } from '../data/images';
import { t } from '../data/strings';
import { platformMark } from './cards';
import { icon, type IconName } from './icons';

/**
 * A hero, as the desktop's: the backdrop under the bar with its veils, an
 * eyebrow, the platform's logo, the title in Bebas, a meta line (and how
 * far the viewer got) and the buttons. A slide shows only over a real
 * backdrop, never a poster: one without, or whose backdrop fails to load
 * or loads as a portrait, leaves the rotation (`usableBackdrop`), and a
 * hero with no slide left hides. A platform's page dresses it as that
 * platform's billboard or carousel (platform-screen.ts, platforms.css):
 * the mark before the eyebrow, Netflix's match and band, Prime Video's
 * "Incluido", the languages' badges, a round ⓘ. With several slides it
 * rotates every ROTATE_MS while it shows and nothing in it has focus;
 * left on the first button and right on the last move between slides.
 */
export interface HeroAction {
    readonly label: string;
    readonly icon?: IconName;
    readonly primary?: boolean;
    /** A round button of the icon alone (HBO Max's and Apple TV's ⓘ). */
    readonly round?: boolean;
    readonly run: () => void;
}

/** Characters from which a hero's title is set smaller. */
const LONG_TITLE = 22;

export interface HeroSlide {
    readonly key: string;
    readonly eyebrow: string;
    readonly platform: StreamingPlatform | null;
    /**
     * A platform page's mark before the eyebrow (the logo, Netflix's N),
     * or null for none (a carousel names its platform in its text); left
     * out, the Home's heroes write the logo under the eyebrow.
     */
    readonly brand?: HTMLElement | null;
    readonly title: string;
    readonly meta: string;
    /** Netflix's "78% de coincidencia" before the meta. */
    readonly match?: number | null;
    /** The languages after the meta, each in a badge: ES, EN. */
    readonly badges?: readonly string[];
    /** Prime Video's "Incluido con Prime" under the title. */
    readonly included?: string | null;
    /** Netflix's band at the billboard's right, carrying the languages. */
    readonly band?: string | null;
    readonly plot?: string | null;
    /** 0–1 watched. */
    readonly progress?: number;
    /** Its backdrop: a slide without one is never shown. */
    readonly backdrop: string | null;
    readonly hue: number;
    /** The stage's own colour under the artwork (a platform's), instead of the hue's tint. */
    readonly stage?: string | null;
    readonly actions: readonly HeroAction[];
}

const ROTATE_MS = 8000;
/** An image this many times wider than tall is a backdrop, not a poster. */
const LANDSCAPE = 1.2;

/** Backdrops that failed to load, or were posters, this session. */
const failedBackdrops = new Set<string>();

/** A loaded "backdrop" narrower than a banner: a poster the provider named one. */
export function isPoster(image: HTMLImageElement): boolean {
    return image.naturalWidth > 0 && image.naturalWidth < image.naturalHeight * LANDSCAPE;
}

/** A slide's backdrop, unless it is missing or failed: no backdrop, no slide. */
export function usableBackdrop(url: string | null | undefined): string | null {
    return url && !failedBackdrops.has(url) ? url : null;
}

/**
 * A title's backdrop at the hero's size (its list's, or the one its page
 * gave), unless it has none or it failed: such a title is no slide.
 */
export function heroBackdrop(store: { backdropOf(title: PlatformTitle): string | null }, title: PlatformTitle): string | null {
    return usableBackdrop(tmdbSized(store.backdropOf(title), 'w1280'));
}

export class Hero {
    readonly el: HTMLElement;
    private readonly stage = h('div', 'hero__stage');
    private readonly image = h('img', { className: 'hero__image', attrs: { alt: '' } });
    private readonly content = h('div', 'hero__content');
    private readonly actionsEl = h('div', 'hero__actions');
    private readonly band = h('span', 'hero__band');
    private readonly dots = h('div', 'hero__dots');
    private slides: readonly HeroSlide[] = [];
    private index = 0;
    private stopRotation: Stop | null = null;

    /**
     * `onDrop` runs when a slide's backdrop failed and the slide left:
     * the catalog features another title.
     */
    constructor(
        className = '',
        private readonly canRotate: () => boolean = () => true,
        private readonly onDrop: () => void = () => undefined
    ) {
        this.image.onload = () => {
            if (isPoster(this.image)) {
                this.drop();
            } else {
                this.image.classList.add('is-loaded');
            }
        };
        this.image.onerror = () => this.drop();
        this.stage.appendChild(this.image);
        this.stage.appendChild(h('div', 'hero__veil hero__veil--left'));
        this.stage.appendChild(h('div', 'hero__veil hero__veil--top'));
        this.band.style.display = 'none';
        this.el = h('section', `hero ${className}`, this.stage, this.content, this.band, this.dots);
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
        return this.slides.length > 0 ? this.buttons()[0] ?? null : null;
    }

    private lastAction(): HTMLElement | null {
        const buttons = this.buttons();
        return buttons[buttons.length - 1] ?? null;
    }

    /** The slides with a backdrop that loads; the one showing stays. */
    setSlides(slides: readonly HeroSlide[]): void {
        const key = this.current ? this.current.key : null;
        this.slides = slides.filter((slide) => !!usableBackdrop(slide.backdrop));
        const keep = this.slides.findIndex((slide) => slide.key === key);
        this.show(keep >= 0 ? keep : 0);
    }

    private hasFocus(): boolean {
        return !!nav.focused && this.actionsEl.contains(nav.focused);
    }

    /** The backdrop showing failed, or is a poster: its slide leaves. */
    private drop(): void {
        const url = this.image.getAttribute('src');
        if (!url || url !== this.image.getAttribute('data-src')) {
            return;
        }
        failedBackdrops.add(url);
        this.image.removeAttribute('src');
        this.image.removeAttribute('data-src');
        const hadFocus = this.hasFocus();
        this.slides = this.slides.filter((slide) => slide.backdrop !== url);
        this.show(this.index);
        this.onDrop();
        if (hadFocus && !this.hasFocus()) {
            nav.focus(this.firstAction() ?? nav.first(this.el.parentElement ?? undefined));
        }
    }

    show(index: number): void {
        const count = this.slides.length;
        if (count === 0) {
            this.el.style.display = 'none';
            clear(this.content);
            clear(this.dots);
            return;
        }
        this.el.style.display = '';
        const hadFocus = this.hasFocus();
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
            slide.stage ??
            `radial-gradient(90% 110% at 72% 30%, hsl(${slide.hue},30%,34%) 0%, hsl(${slide.hue},30%,14%) 45%, #0b0b0a 85%)`;
        const wanted = slide.backdrop ?? '';
        if (this.image.getAttribute('data-src') !== wanted) {
            // An earlier slide's image still waiting must not land here.
            cancelImage(this.image);
            this.image.setAttribute('data-src', wanted);
            this.image.classList.remove('is-loaded');
            this.image.removeAttribute('src');
            if (slide.backdrop) {
                queueImage(this.image, slide.backdrop);
            }
        }
    }

    private renderContent(slide: HeroSlide): void {
        clear(this.content);
        const progress = slide.progress && slide.progress > 0 ? Math.min(1, slide.progress) : 0;
        const bar = progress > 0 ? h('span', 'hero__progress', h('i')) : null;
        if (bar) {
            (bar.firstChild as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
        }
        if (slide.brand || slide.eyebrow) {
            this.content.appendChild(
                h('p', 'hero__eyebrow', slide.brand ?? null, slide.eyebrow ? h('span', { text: slide.eyebrow }) : null)
            );
        }
        const mark = slide.brand !== undefined ? null : platformMark(slide.platform, 'hero__platform');
        if (mark) {
            this.content.appendChild(mark);
        }
        // A long name ("JO KOY: LIVE FROM THE LOS ANGELES FORUM") is set smaller.
        const long = slide.title.length > LONG_TITLE ? ' is-long' : '';
        this.content.appendChild(h('h2', { className: `hero__title display${long}`, text: slide.title }));
        if (slide.included) {
            this.content.appendChild(h('p', 'hero__included', h('i', 'hero__check'), slide.included));
        }
        const badges = (slide.badges ?? []).map((badge) => h('span', { className: 'hero__badge', text: badge }));
        if (bar || slide.meta || slide.match || badges.length > 0) {
            this.content.appendChild(
                h(
                    'div',
                    'hero__meta',
                    bar,
                    slide.match ? h('span', { className: 'hero__match', text: t('WORKSPACE.DASHBOARD.MATCH', { value: slide.match }) }) : null,
                    slide.meta ? h('span', { text: slide.meta }) : null,
                    ...badges
                )
            );
        }
        if (slide.plot) {
            this.content.appendChild(h('p', { className: 'hero__plot', text: slide.plot }));
        }
        clear(this.actionsEl);
        for (const action of slide.actions) {
            const button = action.round
                ? h('div', 'button button--round', action.icon ? icon(action.icon) : null)
                : h('div', `button${action.primary ? ' button--primary' : ''}`, action.icon ? icon(action.icon) : null, action.label);
            this.actionsEl.appendChild(onActivate(button, action.run));
        }
        this.content.appendChild(this.actionsEl);
        this.band.textContent = slide.band ?? '';
        this.band.style.display = slide.band ? '' : 'none';
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
