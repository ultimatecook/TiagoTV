import {
    buildCatalogRows,
    pickNewReleases,
    type CatalogRow,
    type CatalogTitle,
    type PlatformTitleKind,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h } from '../core/dom';
import { requestErrorText } from '../core/http';
import { nav } from '../core/nav';
import { Slot } from '../core/timers';
import { tmdbSized } from '../data/images';
import { t } from '../data/strings';
import { genreLabel, heroMeta, posterMeta } from '../data/title-meta';
import type { App } from '../app';
import { CARD, landscapeCard, posterCard } from '../ui/cards';
import { hueOf } from '../ui/colour';
import { Hero, type HeroSlide } from '../ui/hero';
import { Row } from '../ui/row';
import { VPage } from '../ui/vpage';
import { playTitle } from './play-title';
import type { Page } from './shell';

/**
 * Series and Películas, as the desktop's: every platform's titles of the
 * kind in one catalog (one per show across languages and platforms, the
 * platforms taking turns). A cinematic hero with the featured title, the
 * "Novedades" over it (focusing one features it), then a row per genre.
 */
const REFRESH_MS = 1500;
const FEATURE_MS = 450;

export class CatalogPage implements Page {
    private readonly page: VPage;
    private readonly hero = new Hero('hero--catalog');
    private readonly news: Row<CatalogTitle>;
    private rows: Row<CatalogTitle>[] = [];
    private readonly refresh = new Slot('catalog-refresh');
    private readonly feature = new Slot('catalog-feature');
    private readonly lead = Math.floor(Math.random() * 6);
    private featured: CatalogTitle | null = null;
    private visible = false;
    private loading = false;
    private complete = false;

    constructor(
        private readonly app: App,
        private readonly kind: PlatformTitleKind
    ) {
        this.page = new VPage(`page page--catalog page--${kind}`, 130);
        const label = t(kind === 'movie' ? 'WORKSPACE.CATALOG.MOVIES' : 'WORKSPACE.CATALOG.SERIES');
        this.news = new Row<CatalogTitle>({
            title: t('WORKSPACE.CATALOG.NEW'),
            variant: 'landscape',
            cardWidth: CARD.landscape.width,
            gap: CARD.landscape.gap,
            render: (title) => landscapeCard({ title, platform: title.platform }),
            activate: (title) => app.openTitle(title),
            onFocusItem: (title) => this.feature.later(FEATURE_MS, () => this.setFeatured(title)),
        });
        // The hero and "Novedades" scroll as one: focusing a novelty shows
        // it in the hero above.
        const top = h('div', { className: 'catalog__top', attrs: { 'data-anchor': '' } }, h('div', 'catalog__hero', h('div', { className: 'catalog__label', text: label }), this.hero.el));
        this.page.add(top);
        this.page.add(this.news, top);
        this.news.setStatus(t('WORKSPACE.CATALOG.LOADING'));
        app.store.onChange(() => {
            if (this.visible && !this.refresh.pending) {
                this.refresh.later(REFRESH_MS, () => this.render());
            }
        });
    }

    get el(): HTMLElement {
        return this.page.el;
    }

    focusTarget(): HTMLElement | null {
        return this.hero.firstAction() ?? nav.first(this.page.el);
    }

    show(): void {
        this.visible = true;
        this.render();
        if (!this.complete && !this.loading) {
            void this.load();
        }
        this.page.updateNear();
    }

    hide(): void {
        this.visible = false;
        this.refresh.clear();
        this.feature.clear();
    }

    private async load(): Promise<void> {
        this.loading = true;
        try {
            await this.app.store.load([this.kind]);
            this.complete = await this.app.store.complete([this.kind]);
        } catch (error) {
            this.news.setStatus(`${requestErrorText(error)} ${t('WORKSPACE.CATALOG.FAILED')}`, () => void this.load());
        } finally {
            this.loading = false;
        }
        if (this.visible) {
            this.render();
        }
    }

    private slide(title: CatalogTitle): HeroSlide {
        return {
            key: `${title.kind}:${title.id}`,
            eyebrow: '',
            platform: title.platform,
            title: title.title,
            meta: heroMeta(title) + (title.genres[1] ? `, ${genreLabel(title.genres[1])}` : ''),
            backdrop: tmdbSized(this.app.store.backdropOf(title), 'w1280'),
            keyart: tmdbSized(title.poster, 'w500'),
            hue: hueOf(title.title),
            actions: [
                { label: t('WORKSPACE.CATALOG.PLAY'), icon: 'play', primary: true, run: () => playTitle(this.app, title) },
                { label: t('WORKSPACE.CATALOG.MORE_INFO'), run: () => this.app.openTitle(title) },
            ],
        };
    }

    private setFeatured(title: CatalogTitle): void {
        this.featured = title;
        this.hero.setSlides([this.slide(title)]);
    }

    private render(): void {
        const titles = this.app.store.titles(this.kind);
        if (titles.length === 0) {
            if (this.complete) {
                this.news.setStatus(t(this.kind === 'movie' ? 'WORKSPACE.CATALOG.EMPTY_MOVIES' : 'WORKSPACE.CATALOG.EMPTY_SERIES'));
            }
            return;
        }
        const releases = pickNewReleases(titles, 12, this.lead);
        void this.app.store.probeBackdrops(releases);
        this.news.setItems(releases, true);
        if (!this.featured || releases.indexOf(this.featured) < 0) {
            this.setFeatured(releases[0]);
        }
        this.renderRows(buildCatalogRows(titles));
        this.page.updateNear();
    }

    private renderRows(rows: readonly CatalogRow[]): void {
        const focused = nav.focused;
        const keep: Row<CatalogTitle>[] = [];
        rows.forEach((data, index) => {
            const title = data.genre ? genreLabel(data.genre) : data.platform ? data.platform.name : '';
            let row = this.rows[index];
            if (!row) {
                row = new Row<CatalogTitle>({
                    title,
                    variant: 'posters',
                    cardWidth: CARD.poster.width,
                    gap: CARD.poster.gap,
                    render: (item) => posterCard({ title: item, platform: item.platform, meta: posterMeta(item) }),
                    activate: (item) => this.app.openTitle(item),
                });
                this.page.add(row);
            }
            row.setTitle(title);
            row.setItems(data.titles, true);
            keep.push(row);
        });
        this.page.removeRows(this.rows.slice(keep.length));
        this.rows = keep;
        if (focused && !document.body.contains(focused) && this.visible) {
            nav.focus(nav.first(this.page.el));
        }
    }
}
