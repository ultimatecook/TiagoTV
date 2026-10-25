import {
    countryCards,
    countryCategories,
    type TvCard,
    type TvCategoryId,
    type TvCountry,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h, toggleClass } from '../core/dom';
import { requestErrorText } from '../core/http';
import type { Action } from '../core/keys';
import { nav, onActivate } from '../core/nav';
import { Slot } from '../core/timers';
import { rowLabelText } from '../data/labels';
import { LIVE_COUNTRIES, toLiveChannel } from '../data/live';
import { t, tKey } from '../data/strings';
import type { App, PlayItem } from '../app';
import { ZAP_DELAY_MS } from '../player/controller';
import { CARD, channelCard } from '../ui/cards';
import { Row } from '../ui/row';
import { Stage } from '../ui/stage';
import type { Page } from './shell';

/**
 * En vivo, as the desktop's: the player fills the screen behind the page;
 * the countries (Argentina, España, Reino Unido, Estados Unidos) top
 * right; over the picture's foot the channel that plays, the category
 * chips (Todos, Deportes, Generalistas…) and the channels. OK plays a
 * channel here; OK on the one that plays goes full screen; CH+/CH- zap.
 * Idle, the chrome steps aside and leaves the picture alone.
 */
export class LivePage implements Page {
    readonly el: HTMLElement;
    private readonly stage: Stage;
    private readonly countriesEl = h('div', 'chips live__countries');
    private readonly categoriesEl = h('div', 'chips live__categories');
    private readonly channels: Row<TvCard>;
    private readonly overlay: HTMLElement;
    private readonly load = new Slot('live-load');
    private selected: string;
    private country: TvCountry | null = null;
    private category: TvCategoryId = 'all';
    private playingId: number | null = null;
    private token = 0;

    constructor(private readonly app: App) {
        const remembered = app.prefs().country;
        this.selected = LIVE_COUNTRIES.some((entry) => entry.id === remembered)
            ? (remembered as string)
            : LIVE_COUNTRIES[0].id;
        this.stage = new Stage(app, {
            onItem: (item, index) => this.markPlaying(item, index),
            setBare: (bare) => {
                toggleClass(this.el, 'is-bare', bare);
                app.setBarHidden(bare);
            },
        });
        this.channels = new Row<TvCard>({
            title: '',
            headless: true,
            variant: 'channels',
            cardWidth: CARD.channel.width,
            gap: CARD.channel.gap,
            render: (card) => channelCard(toLiveChannel(card.channel), rowLabelText(card.row.label), card.channel.copies[0].streamId === this.playingId),
            activate: (_, index) => this.play(index),
        });
        this.overlay = h(
            'div',
            'live__overlay',
            h('div', 'live__now', this.stage.title, this.stage.subtitle),
            this.categoriesEl,
            this.channels.el
        );
        this.el = h('div', 'page page--live', this.stage.el, h('div', 'live__veil'), this.countriesEl, this.overlay);
        this.renderCountries();
    }

    focusTarget(): HTMLElement | null {
        return this.channels.enter() ?? nav.first(this.overlay);
    }

    show(): void {
        this.channels.setNear(true);
        if (!this.country && !this.load.pending) {
            // Moving across the tabs does not start a load on each one.
            this.load.later(250, () => void this.loadCountry(this.selected));
        }
    }

    hide(): void {
        this.load.clear();
        if (!this.stage.handingOff) {
            this.stage.stop();
            this.markPlaying(null, -1);
        }
    }

    onKey(action: Action): boolean {
        if (this.stage.wake()) {
            return true;
        }
        if (action === 'channelUp' || action === 'channelDown') {
            return this.stage.zap(action === 'channelUp' ? 1 : -1, ZAP_DELAY_MS);
        }
        return false;
    }

    private renderCountries(): void {
        const focusedHere = !!nav.focused && this.countriesEl.contains(nav.focused);
        clear(this.countriesEl);
        for (const country of LIVE_COUNTRIES) {
            const chip = h(
                'div',
                `chip chip--country${country.id === this.selected ? ' is-selected' : ''}`,
                h('img', { className: 'chip__flag', attrs: { src: country.flag, alt: '' } }),
                country.name
            );
            this.countriesEl.appendChild(onActivate(chip, () => this.choose(country.id)));
            if (focusedHere && country.id === this.selected) {
                nav.focus(chip);
            }
        }
    }

    private choose(id: string): void {
        if (id === this.selected && this.country) {
            nav.focus(this.focusTarget());
            return;
        }
        this.selected = id;
        this.app.setPrefs({ country: id });
        this.renderCountries();
        void this.loadCountry(id);
    }

    private async loadCountry(id: string): Promise<void> {
        const token = ++this.token;
        this.country = null;
        this.stage.title.textContent = LIVE_COUNTRIES.find((entry) => entry.id === id)?.name ?? '';
        this.stage.subtitle.textContent = t('WORKSPACE.COUNTRIES.LOADING');
        clear(this.categoriesEl);
        this.channels.setStatus(t('WORKSPACE.COUNTRIES.LOADING'));
        try {
            const loaded = await this.app.cache.country(id, (done, total) => {
                if (token === this.token) {
                    this.channels.setStatus(`${t('WORKSPACE.COUNTRIES.LOADING')} ${done} / ${total}`);
                }
            });
            if (token !== this.token) {
                return;
            }
            if (!loaded.country || loaded.country.channelCount === 0) {
                const text = loaded.failed > 0 ? t('WORKSPACE.COUNTRIES.FAILED') : t('WORKSPACE.COUNTRIES.EMPTY');
                this.channels.setStatus(text, () => this.retry(id));
                return;
            }
            this.country = loaded.country;
            if (!this.stage.playing) {
                this.stage.subtitle.textContent = t('WORKSPACE.COUNTRIES.CHANNELS', { count: loaded.country.channelCount });
            }
            this.showCategory('all', false);
        } catch (error) {
            if (token === this.token) {
                this.channels.setStatus(`${requestErrorText(error)}`, () => this.retry(id));
            }
        }
    }

    private retry(id: string): void {
        this.app.cache.forget(`country:${id}`);
        void this.loadCountry(id);
    }

    private showCategory(category: TvCategoryId, focus = true): void {
        const country = this.country;
        if (!country) {
            return;
        }
        this.category = category;
        clear(this.categoriesEl);
        for (const entry of countryCategories(country)) {
            const chip = h(
                'div',
                `chip${entry.id === category ? ' is-selected' : ''}`,
                tKey(entry.labelKey),
                h('span', { className: 'chip__count', text: String(entry.count) })
            );
            this.categoriesEl.appendChild(onActivate(chip, () => this.showCategory(entry.id)));
            if (focus && entry.id === category) {
                nav.focus(chip);
            }
        }
        this.channels.setItems(countryCards(country, category));
        if (!focus && nav.focused && !document.body.contains(nav.focused)) {
            nav.focus(this.channels.enter());
        }
    }

    private items(): PlayItem[] {
        const name = LIVE_COUNTRIES.find((entry) => entry.id === this.selected)?.name ?? '';
        return this.channels.itemList.map((card) => {
            const channel = toLiveChannel(card.channel);
            return {
                kind: 'live',
                id: channel.streamId,
                title: channel.title,
                subtitle: `${name} · ${rowLabelText(card.row.label)}`,
                logo: channel.logo,
                country: this.selected,
            };
        });
    }

    private play(index: number): void {
        const items = this.items();
        this.stage.play({ items, index, onIndexChange: (next) => this.follow(next) });
    }

    /** The channel zapped to takes focus (or will, after the full screen). */
    private follow(index: number): void {
        const card = this.channels.cardAt(index);
        if (this.stage.handingOff) {
            this.app.stack.setReturnFocus(card);
        } else {
            nav.focus(card);
        }
    }

    private markPlaying(item: PlayItem | null, index: number): void {
        this.playingId = item ? item.id : null;
        this.channels.eachCard((card, entry) => {
            toggleClass(card, 'is-playing', entry.channel.copies[0].streamId === this.playingId);
        });
        if (item && index >= 0 && nav.focused && this.channels.el.contains(nav.focused)) {
            nav.focus(this.channels.cardAt(index));
        }
    }
}
