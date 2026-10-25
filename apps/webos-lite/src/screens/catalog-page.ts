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
import { t } from '../data/strings';
import { genreLabel, heroMeta, posterMeta } from '../data/title-meta';
import type { App } from '../app';
import { CARD, landscapeCard, posterCard } from '../ui/cards';
import { hueOf } from '../ui/colour';
import { Hero, heroBackdrop, type HeroSlide } from '../ui/hero';
import { Row } from '../ui/row';
import { VPage } from '../ui/vpage';
import { playTitle } from './play-title';
import type { Page } from './shell';

/**
 * Series and Películas, as the desktop's: every platform's titles of the
 * kind in one catalog (one per show across languages and platforms, the
 * platforms taking turns). A cinematic hero with the featured title, the
 * "Novedades" over it (focusing one features it), then a row per genre.
 * The hero features a title only over its backdrop, never its poster: the
 * first of "Novedades" with one, and focusing one without leaves the hero
 * as it is; with none yet, the section's name shows alone.
 */
const REFRESH_MS = 1500;
const FEATURE_MS = 450;

export class CatalogPage implements Page {
    private readonly page: VPage;
    private readonly hero = new Hero('hero--catalog', undefined, () => this.featureFirst());
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
        let failure: unknown = null;
        try {
            await this.app.store.load([this.kind]);
            this.complete = await this.app.store.settled([this.kind]);
        } catch (error) {
            failure = error;
        }
        this.loading = false;
        if (failure || (this.complete && this.app.store.titles(this.kind).length === 0)) {
            // Never "Cargando…" for good: what failed, and a way to ask again.
            const error = failure ?? this.app.store.errorOf(this.kind);
            if (error) {
                this.complete = false;
                this.news.setStatus(`${requestErrorText(error)} ${t('WORKSPACE.CATALOG.FAILED')}`, () => this.reload());
                return;
            }
        }
        if (this.visible) {
            this.render();
        }
    }

    private reload(): void {
        if (!this.loading) {
            this.news.setStatus(t('WORKSPACE.CATALOG.LOADING'));
            void this.load();
        }
    }

    private slide(title: CatalogTitle): HeroSlide {
        return {
            key: `${title.kind}:${title.id}`,
            eyebrow: '',
            platform: title.platform,
            title: title.title,
            meta: heroMeta(title) + (title.genres[1] ? `, ${genreLabel(title.genres[1])}` : ''),
            backdrop: heroBackdrop(this.app.store, title),
            hue: hueOf(title.title),
            actions: [
                { label: t('WORKSPACE.CATALOG.PLAY'), icon: 'play', primary: true, run: () => playTitle(this.app, title) },
                { label: t('WORKSPACE.CATALOG.MORE_INFO'), run: () => this.app.openTitle(title) },
            ],
        };
    }

    /** Features the title, when it has a backdrop; else the hero stays. */
    private setFeatured(title: CatalogTitle): void {
        if (!heroBackdrop(this.app.store, title)) {
            return;
        }
        this.featured = title;
        this.hero.setSlides([this.slide(title)]);
    }

    /** The first of "Novedades" with a backdrop, or no title at all. */
    private featureFirst(): void {
        const releases = this.news.itemList;
        const first = releases.filter((title) => !!heroBackdrop(this.app.store, title))[0];
        this.featured = null;
        if (first) {
            this.setFeatured(first);
        } else {
            this.hero.setSlides([]);
        }
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
        const featured = this.featured;
        const same = featured ? releases.filter((title) => title.kind === featured.kind && title.id === featured.id)[0] : undefined;
        if (same && heroBackdrop(this.app.store, same)) {
            if (same !== featured) {
                this.setFeatured(same);
            }
        } else {
            this.featureFirst();
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
