import {
    languageVersions,
    platformDesign,
    type CatalogTitle,
    type PlatformTitle,
    type PlatformTitleVersion,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h } from '../core/dom';
import { queueImage } from '../core/image-queue';
import { requestErrorText } from '../core/http';
import { nav, onActivate } from '../core/nav';
import type { Screen } from '../core/screens';
import { parseSeriesInfo, parseVodInfo, type Episode, type SeriesDetails, type TitleDetails } from '../data/details';
import { tmdbSized } from '../data/images';
import { myList } from '../data/my-list';
import { resume } from '../data/resume';
import { t } from '../data/strings';
import { kindLabel } from '../data/title-meta';
import type { App, OpenTitleOptions } from '../app';
import { isPoster } from '../ui/hero';
import { icon } from '../ui/icons';
import { brandMark } from '../ui/platform-cards';
import { detailVeil, lookClasses, lookOf } from '../ui/platform-looks';
import { screenBar } from '../ui/screen-bar';
import { VPage } from '../ui/vpage';
import { detailMeta, episodeRow, moreTitlesRow, seasonChip } from './detail-parts';
import { DetailPlayback } from './detail-playback';

/**
 * A movie's or a series' page, as the desktop's: the backdrop under the
 * bar (never the poster in its place: without one, the look's colour
 * alone), the platform and kind, the title in Bebas, year, genres and
 * rating, the synopsis, Reproducir (or Continuar where it was left) and
 * Mi lista; a series adds "Episodios" by season; "Más títulos" of its
 * platform close the page. A title in Spanish and English offers both.
 * A platform's title takes that platform's look (platform-looks.ts,
 * platforms.css), wherever it was opened from: its page, Series,
 * Películas, Buscar, Mi lista or Seguir viendo.
 */
const LANGUAGE: Readonly<Record<string, string>> = { ES: 'Español', EN: 'English' };

export class DetailScreen implements Screen {
    readonly el: HTMLElement;
    private readonly page = new VPage('detail__page', 120);
    private readonly backdrop = h('img', { className: 'detail__backdrop', attrs: { alt: '' } });
    private readonly meta = h('div', 'detail__meta');
    private readonly plot = h('p', 'detail__plot');
    private readonly actions = h('div', 'detail__actions');
    private readonly episodesBlock = h('section', 'detail__episodes');
    private readonly seasonsEl = h('div', 'chips detail__seasons');
    private readonly episodesEl = h('div', 'episodes');
    private readonly platform: StreamingPlatform | null;
    private readonly playback: DetailPlayback;
    private version: PlatformTitleVersion;
    private details: TitleDetails | null = null;
    private series: SeriesDetails | null = null;
    private season = 0;
    private token = 0;
    /** The episode to focus when the player closes (it re-renders). */
    private restore: number | null = null;

    constructor(
        private readonly app: App,
        private readonly title: PlatformTitle,
        private readonly options: OpenTitleOptions
    ) {
        this.version = title.versions[0] ?? title;
        this.platform = (title as CatalogTitle).platform ?? app.store.platformOf(title);
        this.playback = new DetailPlayback(app, title, () => this.version, () => this.details);
        // A portrait "backdrop" is a poster: no banner rather than that.
        this.backdrop.onload = () => {
            if (isPoster(this.backdrop)) {
                this.backdrop.removeAttribute('src');
            } else {
                this.backdrop.classList.add('is-loaded');
            }
        };
        this.backdrop.onerror = () => this.backdrop.removeAttribute('src');
        const look = this.platform ? platformDesign(this.platform.id).look : 'default';
        const tone = lookOf(look);
        // The platform's mark names it: the kind alone follows.
        const eyebrow = h('div', 'detail__eyebrow', brandMark(this.platform, look, 'detail__mark'), h('span', { text: kindLabel(title.kind) }));
        this.page.add(
            h('div', { className: 'detail__header', attrs: { 'data-anchor': '' } }, eyebrow, h('h1', { className: 'detail__title display', text: title.title }), this.meta, this.plot, this.actions)
        );
        if (title.kind === 'series') {
            this.episodesBlock.appendChild(
                h('div', 'heading', h('h2', { className: 'heading__title', text: t('PORTALS.DETAIL.EPISODES') }))
            );
            this.episodesBlock.appendChild(this.seasonsEl);
            this.episodesBlock.appendChild(this.episodesEl);
            this.page.add(this.episodesBlock);
            this.say(t('WORKSPACE.PLATFORMS.LOADING'));
        }
        const more = moreTitlesRow(app, title, this.platform, look);
        if (more) {
            this.page.add(more);
        }
        const active = title.kind === 'movie' ? 'movies' : 'series';
        const veil = h('div', 'detail__veil');
        veil.style.background = detailVeil(tone.page);
        this.el = h(
            'div',
            `screen detail ${lookClasses(look)}`,
            h('div', 'detail__stage', this.backdrop, veil),
            this.page.el,
            h('div', 'shell__veil'),
            screenBar(active, (id) => app.openTab(id))
        );
        this.el.style.background = tone.page;
        this.render();
        void this.load();
    }

    initialFocus(): HTMLElement | null {
        const restore = this.restore;
        this.restore = null;
        const row = restore !== null ? (this.episodesEl.children[restore] as HTMLElement | undefined) : undefined;
        return row ?? nav.first(this.actions);
    }

    onShow(): void {
        // Back from the player: "Continuar" and the episodes' progress.
        this.renderActions();
        if (this.series) {
            this.renderEpisodes(false);
        }
        this.page.updateNear();
    }

    onHide(): void {
        const focused = nav.focused;
        this.restore = focused && this.episodesEl.contains(focused) ? Array.prototype.indexOf.call(this.episodesEl.children, focused) : null;
    }

    private get isSeries(): boolean {
        return this.title.kind === 'series';
    }

    private say(text: string): void {
        clear(this.episodesEl);
        this.episodesEl.appendChild(h('p', { className: 'status', text }));
    }

    private async load(): Promise<void> {
        const token = ++this.token;
        const id = this.version.id;
        try {
            if (this.isSeries) {
                const series = parseSeriesInfo(await this.app.client.seriesInfo(id));
                if (token !== this.token) {
                    return;
                }
                this.series = series;
                this.details = series;
                this.showSeasons(series);
                if (this.options.autoplay && series.seasons.length > 0) {
                    this.playback.playFirst(series, (season) => this.showSeason(season, false));
                }
            } else {
                const movie = parseVodInfo(await this.app.client.vodInfo(id));
                if (token !== this.token) {
                    return;
                }
                this.details = movie;
            }
        } catch (error) {
            if (token === this.token && this.isSeries) {
                this.say(`${requestErrorText(error)}`);
            }
        }
        this.render();
    }

    private render(): void {
        const details = this.details;
        this.meta.textContent = '';
        detailMeta(this.title, details).forEach((part) => this.meta.appendChild(part));
        this.plot.textContent = details?.plot ?? this.title.plot ?? '';
        const image = tmdbSized(details?.backdrop ?? this.title.backdrop, 'w1280');
        if (image && this.backdrop.getAttribute('data-src') !== image) {
            this.backdrop.setAttribute('data-src', image);
            this.backdrop.classList.remove('is-loaded');
            queueImage(this.backdrop, image);
        }
        this.renderActions();
    }

    private renderActions(): void {
        const focusedHere = !!nav.focused && this.actions.contains(nav.focused);
        const focusedIndex = focusedHere ? Array.prototype.indexOf.call(this.actions.children, nav.focused) : 0;
        clear(this.actions);
        const add = (el: HTMLElement, run: () => void) => this.actions.appendChild(onActivate(el, run));
        const primary = (label: string, sub: string | null, run: () => void) =>
            add(
                h('div', 'button button--primary button--play', icon('play'), h('span', 'play__label', label, sub ? h('small', { text: sub }) : null)),
                run
            );
        if (this.isSeries) {
            const last = resume.recent('episode', 50).find((entry) => entry.seriesId === this.version.id);
            if (last) {
                primary(t('XTREAM.RESUME'), `T${last.season}:E${last.episode}`, () =>
                    this.playback.resumeEpisode(this.series, last.id, (season) => this.showSeason(season, false))
                );
            } else if (this.series && this.series.seasons.length > 0) {
                primary(t('WORKSPACE.CATALOG.PLAY'), 'T1:E1', () =>
                    this.series && this.playback.playFirst(this.series, (season) => this.showSeason(season, false))
                );
            }
        } else {
            const position = resume.positionOf('movie', this.version.id);
            primary(position > 0 ? t('XTREAM.RESUME') : t('WORKSPACE.CATALOG.PLAY'), null, () => this.playback.playMovie(position));
            if (position > 0) {
                add(h('div', { className: 'button', text: 'Desde el principio' }), () => this.playback.playMovie(0));
            }
        }
        const kind = this.isSeries ? 'series' : 'movie';
        const saved = myList.has(kind, this.title.id);
        add(h('div', `button button--round${saved ? ' is-on' : ''}`, icon(saved ? 'heart-on' : 'heart')), () => {
            myList.toggle({ kind, id: this.title.id, title: this.title.title, image: this.title.poster, categoryId: this.title.categoryId });
            this.renderActions();
        });
        const versions = languageVersions(this.title);
        for (const version of versions) {
            if (versions.length > 1 && version.id !== this.version.id) {
                add(h('div', { className: 'button button--small', text: LANGUAGE[version.language] ?? version.language }), () =>
                    this.useVersion(version)
                );
            }
        }
        if (focusedHere || !nav.focused || !document.body.contains(nav.focused)) {
            const buttons = this.actions.children;
            nav.focus((buttons[Math.min(focusedIndex, buttons.length - 1)] as HTMLElement) ?? null);
        }
    }

    private useVersion(version: PlatformTitleVersion): void {
        this.version = version;
        this.series = null;
        if (this.isSeries) {
            clear(this.seasonsEl);
            this.say(t('WORKSPACE.PLATFORMS.LOADING'));
        }
        this.renderActions();
        void this.load();
    }

    private showSeasons(series: SeriesDetails): void {
        if (series.seasons.length === 0) {
            this.say(t('PORTALS.NO_EPISODES'));
            return;
        }
        const last = resume.recent('episode', 50).find((entry) => entry.seriesId === this.version.id);
        const start = last && series.seasons.indexOf(last.season ?? -1) >= 0 ? (last.season as number) : series.seasons[0];
        this.showSeason(start, false);
    }

    private showSeason(season: number, focus = true): void {
        if (!this.series) {
            return;
        }
        this.season = season;
        clear(this.seasonsEl);
        for (const each of this.series.seasons) {
            this.seasonsEl.appendChild(onActivate(seasonChip(each, each === season), () => this.showSeason(each)));
        }
        this.renderEpisodes(focus);
    }

    private renderEpisodes(focus: boolean): void {
        if (!this.series) {
            return;
        }
        const episodes: readonly Episode[] = this.series.episodes.get(this.season) ?? [];
        const focusedIndex = nav.focused && this.episodesEl.contains(nav.focused) ? Array.prototype.indexOf.call(this.episodesEl.children, nav.focused) : -1;
        clear(this.episodesEl);
        episodes.forEach((episode, index) => {
            this.episodesEl.appendChild(
                onActivate(episodeRow(episode), () =>
                    this.playback.playEpisode(episodes, index, this.episodesEl, false, (next) => (this.restore = next))
                )
            );
        });
        const target = focusedIndex >= 0 ? focusedIndex : focus ? 0 : -1;
        if (target >= 0 && this.episodesEl.children[target]) {
            nav.focus(this.episodesEl.children[target] as HTMLElement);
        }
        this.page.updateNear();
    }
}
