import {
    buildPlatformRows,
    daySeed,
    findStreamingPlatform,
    languagesLabel,
    pickRecommendations,
    platformDesign,
    type PlatformDesign,
    type PlatformRow,
    type PlatformTitle,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h } from '../core/dom';
import { requestErrorText } from '../core/http';
import { nav } from '../core/nav';
import type { Screen } from '../core/screens';
import { Slot } from '../core/timers';
import { tmdbSized } from '../data/images';
import { t, tKey } from '../data/strings';
import { genreLabel, kindLabel, posterMeta } from '../data/title-meta';
import type { App } from '../app';
import { CARD, landscapeCard, posterCard, top10Card } from '../ui/cards';
import { hueOf, tint } from '../ui/colour';
import { Hero, type HeroSlide } from '../ui/hero';
import { Row } from '../ui/row';
import { screenBar } from '../ui/screen-bar';
import { VPage } from '../ui/vpage';
import { playTitle } from './play-title';

/**
 * A streaming platform's page, as the desktop draws it after the
 * platform's own app (platform-design.ts): its ground and colour, a
 * billboard of the day's recommendations, then its rows (Lo más nuevo,
 * Netflix's Top 10, Películas, Series, its genres; buildPlatformRows) in
 * 16:9 tiles or posters, as the platform does.
 */
const REFRESH_MS = 1200;

const GROUNDS: Readonly<Record<string, string>> = {
    netflix: '#141414',
    prime: 'linear-gradient(180deg, #0f171e 0%, #0b1118 100%)',
    hbo: 'linear-gradient(180deg, #0a0a24 0%, #04040c 100%)',
    disney: 'linear-gradient(180deg, #13183a 0%, #080b1f 100%)',
    apple: 'linear-gradient(180deg, #1c1c1e 0%, #0a0a0b 100%)',
};

function ground(platform: StreamingPlatform, design: PlatformDesign): string {
    return (
        GROUNDS[design.look] ??
        `radial-gradient(120% 70% at 50% 0%, ${tint(platform.ambient, '#000000', 0.5, 0.55)} 0%, rgba(0,0,0,0) 60%), #0d0d10`
    );
}

export class PlatformScreen implements Screen {
    readonly el: HTMLElement;
    private readonly page = new VPage('platform__page', 130);
    private readonly hero = new Hero('hero--platform');
    private readonly status: Row<never>;
    private rows: Row<PlatformTitle>[] = [];
    private readonly refresh = new Slot('platform-refresh');
    private readonly platform: StreamingPlatform | null;
    private readonly design: PlatformDesign;
    private readonly stopListening: () => void;
    private visible = false;

    constructor(
        private readonly app: App,
        private readonly platformId: string
    ) {
        this.platform = findStreamingPlatform(platformId);
        this.design = platformDesign(this.platform ? this.platform.id : 'netflix');
        this.status = new Row<never>({
            title: '',
            headless: true,
            variant: 'status',
            cardWidth: 900,
            gap: 0,
            render: () => h('div'),
            activate: () => undefined,
        });
        this.status.setStatus(t('WORKSPACE.PLATFORMS.LOADING'));
        this.page.add(this.hero.el);
        this.page.add(this.status);
        const stage = h('div', 'platform__ground');
        if (this.platform) {
            stage.style.background = ground(this.platform, this.design);
        }
        this.el = h(
            'div',
            `screen platform-page look--${this.design.look}`,
            stage,
            this.page.el,
            h('div', 'shell__veil'),
            screenBar('home', (id) => app.openTab(id))
        );
        this.stopListening = app.store.onChange(() => {
            if (this.visible && !this.refresh.pending) {
                this.refresh.later(REFRESH_MS, () => this.render());
            }
        });
        void this.load();
    }

    initialFocus(): HTMLElement | null {
        return this.hero.firstAction() ?? nav.first(this.page.el);
    }

    onShow(): void {
        this.visible = true;
        this.render();
        this.hero.start();
    }

    onHide(): void {
        this.visible = false;
        this.hero.stop();
        this.refresh.clear();
    }

    destroy(): void {
        this.stopListening();
    }

    private async load(): Promise<void> {
        try {
            await this.app.store.load(['movie', 'series'], this.platformId);
        } catch (error) {
            this.status.setStatus(`${requestErrorText(error)} ${t('WORKSPACE.PLATFORMS.FAILED')}`, () => void this.load());
            return;
        }
        if (this.visible) {
            this.render();
        }
    }

    private slide(title: PlatformTitle): HeroSlide {
        const meta = title.genres.slice(0, 2).map(genreLabel).concat(languagesLabel(title)).join(' · ');
        return {
            key: `${title.kind}:${title.id}`,
            eyebrow: kindLabel(title.kind),
            platform: this.platform,
            title: title.title,
            meta,
            plot: title.plot,
            backdrop: tmdbSized(this.app.store.backdropOf(title), 'w1280'),
            keyart: tmdbSized(title.poster, 'w500'),
            hue: hueOf(title.title),
            actions: [
                { label: tKey(this.design.playKey), icon: 'play', primary: true, run: () => playTitle(this.app, title) },
                { label: t('WORKSPACE.PLATFORMS.MORE_INFO'), icon: 'info', run: () => this.app.openTitle(title) },
            ],
        };
    }

    private render(): void {
        const platform = this.platform;
        const titles = platform ? this.app.store.platformTitles(platform.id) : [];
        if (titles.length === 0) {
            return;
        }
        const seed = daySeed();
        const picks = pickRecommendations(titles, 6, seed);
        void this.app.store.probeBackdrops(picks);
        this.hero.setSlides(picks.map((title) => this.slide(title)));
        this.status.el.style.display = 'none';
        const rows = buildPlatformRows(titles, {
            top10Of: this.design.top10 && platform ? platform.name : undefined,
            hero: picks,
            seed,
        });
        this.renderRows(rows);
        this.hero.start();
        const focused = nav.focused;
        if (focused && !document.body.contains(focused)) {
            nav.focus(this.initialFocus());
        }
        this.page.updateNear();
    }

    private tile(row: PlatformRow): 'landscape' | 'poster' {
        const other = this.design.otherTileRows && this.design.otherTileRows.indexOf(row.id) >= 0;
        const tile = this.design.tiles;
        return other ? (tile === 'landscape' ? 'poster' : 'landscape') : tile;
    }

    private renderRows(rows: readonly PlatformRow[]): void {
        this.page.removeRows(this.rows);
        this.rows = rows.map((data) => {
            const ranked = !!data.ranked;
            const tile = this.tile(data);
            const size = ranked ? CARD.top10 : tile === 'landscape' ? CARD.landscape : CARD.poster;
            const platform = this.platform;
            const row = new Row<PlatformTitle>({
                title: tKey(data.labelKey, data.labelParams ?? {}),
                variant: ranked ? 'top10' : tile === 'landscape' ? 'landscape' : 'posters',
                cardWidth: size.width,
                gap: size.gap,
                render: (title, index) =>
                    ranked
                        ? top10Card({ title, platform, meta: posterMeta(title) }, index + 1)
                        : tile === 'landscape'
                          ? landscapeCard({ title, platform })
                          : posterCard({ title, platform, meta: posterMeta(title) }),
                activate: (title) => this.app.openTitle(title),
            });
            row.setItems(data.titles);
            this.page.add(row);
            return row;
        });
    }
}
