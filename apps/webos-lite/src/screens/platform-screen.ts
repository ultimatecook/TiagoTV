import {
    buildBrandRows,
    buildPlatformRows,
    daySeed,
    findStreamingPlatform,
    languagesLabel,
    languageVersions,
    pickRecommendations,
    platformDesign,
    tileDress,
    type PlatformBrandRow,
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
import { genreLabel, kindLabel } from '../data/title-meta';
import type { App } from '../app';
import { hueOf } from '../ui/colour';
import { Hero, type HeroSlide } from '../ui/hero';
import { brandMark, brandTile, platformTile, rankedTile, TILE, tileSize, tileVariant } from '../ui/platform-cards';
import { lookClasses, lookOf, type TvLook } from '../ui/platform-looks';
import { Row } from '../ui/row';
import { screenBar } from '../ui/screen-bar';
import { VPage } from '../ui/vpage';
import { playTitle } from './play-title';

/**
 * A streaming platform's page, as the desktop draws it after the
 * platform's own app (platform-design.ts; here platform-looks.ts and
 * styles/platforms.css): its ground, a billboard of the day's
 * recommendations (or Prime Video's, Disney+'s and mitele's rounded
 * carousel), Disney+'s brand tiles, then its rows (Lo más nuevo,
 * Netflix's Top 10, Películas, Series, its genres; buildPlatformRows) in
 * the tiles the platform uses, badged and named as it names them.
 */
const REFRESH_MS = 1200;

export class PlatformScreen implements Screen {
    readonly el: HTMLElement;
    private readonly page = new VPage('platform__page', 130);
    private readonly hero: Hero;
    private readonly status: Row<never>;
    private titleRows: Row<PlatformTitle>[] = [];
    private brandsRow: Row<PlatformBrandRow> | null = null;
    private readonly refresh = new Slot('platform-refresh');
    private readonly platform: StreamingPlatform | null;
    private readonly design: PlatformDesign;
    private readonly look: TvLook;
    private readonly stopListening: () => void;
    private visible = false;

    constructor(
        private readonly app: App,
        private readonly platformId: string
    ) {
        this.platform = findStreamingPlatform(platformId);
        this.design = platformDesign(this.platform ? this.platform.id : 'netflix');
        this.look = lookOf(this.design.look);
        this.hero = new Hero(`hero--platform ${this.design.hero === 'carousel' ? 'hero--carousel' : 'hero--billboard'}`);
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
        this.el = h(
            'div',
            `screen platform-page ${lookClasses(this.design.look)}`,
            h('div', 'platform__ground'),
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
        const platform = this.platform;
        const carousel = this.design.hero === 'carousel';
        const kind = kindLabel(title.kind);
        const genres = title.genres.slice(0, 2).map(genreLabel);
        return {
            key: `${title.kind}:${title.id}`,
            // A billboard names the kind after the platform's mark; a
            // carousel writes it with the genres, under the title.
            eyebrow: carousel ? '' : kind,
            brand: carousel ? null : brandMark(platform, this.design.look, 'hero__brand'),
            platform,
            title: title.title,
            meta: (carousel ? [kind] : []).concat(genres).join(' · '),
            match: this.look.match && title.rating ? Math.round(title.rating * 10) : null,
            badges: languageVersions(title).map((version) => version.language),
            included: this.look.included ? t('WORKSPACE.PLATFORMS.INCLUDED', { platform: 'Prime' }) : null,
            band: this.look.band ? languagesLabel(title) : null,
            plot: title.plot,
            backdrop: tmdbSized(this.app.store.backdropOf(title), 'w1280'),
            keyart: tmdbSized(title.poster, 'w500'),
            hue: hueOf(title.title),
            stage: this.look.frame ?? (platform ? platform.background : null),
            actions: [
                { label: tKey(this.design.playKey), icon: 'play', primary: true, run: () => playTitle(this.app, title) },
                {
                    label: t('WORKSPACE.PLATFORMS.MORE_INFO'),
                    icon: 'info',
                    round: !this.look.textInfo,
                    run: () => this.app.openTitle(title),
                },
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
        const brands = this.design.brands && platform ? buildBrandRows(titles, platform.name) : [];
        this.renderRows(rows, brands);
        this.hero.start();
        const focused = nav.focused;
        if (focused && !document.body.contains(focused)) {
            nav.focus(this.initialFocus());
        }
        this.page.updateNear();
    }

    /** The brand tiles, each brand's row, then the platform's rows. */
    private renderRows(rows: readonly PlatformRow[], brands: readonly PlatformBrandRow[]): void {
        this.page.removeRows(this.brandsRow ? [this.brandsRow, ...this.titleRows] : this.titleRows);
        const brandRows = brands.map((data) => this.titleRow(data));
        this.brandsRow = brandRows.length > 0 ? this.tilesOfBrands(brands, brandRows) : null;
        this.titleRows = brandRows.concat(rows.map((data) => this.titleRow(data)));
        if (this.brandsRow) {
            this.page.add(this.brandsRow);
        }
        for (const row of this.titleRows) {
            this.page.add(row);
        }
    }

    /** Disney+'s brand tiles: OK on one goes to its row ("Marvel en Disney+"). */
    private tilesOfBrands(brands: readonly PlatformBrandRow[], rows: readonly Row<PlatformTitle>[]): Row<PlatformBrandRow> {
        const row = new Row<PlatformBrandRow>({
            title: t('WORKSPACE.PLATFORMS.BRANDS'),
            headless: true,
            variant: 'brands',
            cardWidth: TILE.brand.width,
            gap: TILE.brand.gap,
            render: (brand) => brandTile(brand),
            activate: (_, index) => nav.focus(rows[index].enter()),
        });
        row.setItems(brands);
        return row;
    }

    private titleRow(data: PlatformRow): Row<PlatformTitle> {
        const platform = this.platform;
        const look = this.design.look;
        const ranked = !!data.ranked;
        const dress = tileDress(this.design, data.id);
        const size = ranked ? TILE.ranked : tileSize(dress);
        const row = new Row<PlatformTitle>({
            title: tKey(data.labelKey, data.labelParams ?? {}),
            variant: ranked ? 'top10' : tileVariant(dress),
            cardWidth: size.width,
            gap: size.gap,
            render: (title, index) =>
                ranked ? rankedTile({ title, platform }, index + 1, look) : platformTile({ title, platform }, dress, look),
            activate: (title) => this.app.openTitle(title),
        });
        row.setItems(data.titles);
        return row;
    }
}
