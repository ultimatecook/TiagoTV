import {
    daySeed,
    homeEventRow,
    pickSeriesForYou,
    rankTopMovies,
    selectHomeEvents,
    SPORTS_ROW,
    type CatalogTitle,
    type HomeEventRow,
    type SportSection,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { requestErrorText } from '../core/http';
import { nav } from '../core/nav';
import { Slot } from '../core/timers';
import { recentChannels, type RecentChannel } from '../data/recent-channels';
import { isLive, liveCounts, matchChannel, matchStreamId, type SportsData } from '../data/sports';
import { t } from '../data/strings';
import { posterMeta } from '../data/title-meta';
import type { App, PlayItem } from '../app';
import { Block } from '../ui/block';
import { CARD, leagueCard, platformCard, recentCard, top10Card } from '../ui/cards';
import { eventsList } from '../ui/events-list';
import { Hero } from '../ui/hero';
import { Row } from '../ui/row';
import { seriesForYou } from '../ui/series-for-you';
import { VPage } from '../ui/vpage';
import { homeSlides } from './home-slides';
import type { Page } from './shell';

/**
 * Inicio, in the desktop's order: the hero (what was left half-watched,
 * then what the platforms added), "Plataformas", "Deportes" (the league
 * cards), "Eventos de hoy", "Top 10 películas hoy", "Series para ti" and
 * "Últimos canales vistos". The catalog and today's matches load in the
 * background, one request at a time, and the rows fill as they arrive.
 */
const REFRESH_MS = 1500;

export class HomePage implements Page {
    private readonly page = new VPage('page page--home', 130);
    private readonly hero: Hero;
    private readonly platforms: Row<StreamingPlatform>;
    private readonly leagues: Row<SportSection>;
    private readonly events = new Block(t('WORKSPACE.DASHBOARD.EVENTS_TODAY'), 'block--events');
    private readonly top10: Row<CatalogTitle>;
    private readonly series = new Block(t('WORKSPACE.DASHBOARD.SERIES_FOR_YOU'), 'block--sfy');
    private readonly recent: Row<RecentChannel>;
    private readonly refresh = new Slot('home-refresh');
    private readonly lead = Math.floor(Math.random() * 6);
    private live = new Map<string, number>();
    private visible = false;
    private dirty = false;
    private started = false;

    constructor(private readonly app: App) {
        this.hero = new Hero('hero--home', () => this.page.scrolled < 200);
        this.platforms = new Row<StreamingPlatform>({
            title: t('WORKSPACE.PLATFORMS.TITLE'),
            variant: 'platforms',
            cardWidth: CARD.platform.width,
            gap: CARD.platform.gap,
            render: (platform) => platformCard(platform),
            activate: (platform) => app.openPlatform(platform.id),
        });
        this.leagues = new Row<SportSection>({
            title: t('WORKSPACE.SPORTS.TITLE'),
            variant: 'leagues',
            cardWidth: CARD.league.width,
            gap: CARD.league.gap,
            render: (section) => leagueCard(section, this.live.get(section.id) ?? 0),
            activate: (section) => app.openLeague(section.id),
        });
        this.top10 = new Row<CatalogTitle>({
            title: t('WORKSPACE.DASHBOARD.TOP_MOVIES'),
            variant: 'top10',
            cardWidth: CARD.top10.width,
            gap: CARD.top10.gap,
            render: (title, index) => top10Card({ title, platform: title.platform, meta: posterMeta(title) }, index + 1),
            activate: (title) => app.openTitle(title),
        });
        this.top10.setNote(t('WORKSPACE.DASHBOARD.ON_YOUR_PLATFORMS'));
        this.recent = new Row<RecentChannel>({
            title: t('WORKSPACE.DASHBOARD.RECENT_CHANNELS'),
            variant: 'recent',
            cardWidth: CARD.recent.width,
            gap: CARD.recent.gap,
            render: (channel) => recentCard(channel),
            activate: (_, index) => this.playRecent(index),
        });
        this.page.add(this.hero.el);
        this.page.add(this.platforms);
        this.page.add(this.leagues);
        this.page.add(this.events.el);
        this.page.add(this.top10);
        this.page.add(this.series.el);
        this.page.add(this.recent);
        this.platforms.setStatus(t('WORKSPACE.CATALOG.LOADING'));
        this.leagues.setItems(SPORTS_ROW);
        this.events.say(t('WORKSPACE.SPORTS.LOADING'));
        this.top10.setStatus(t('WORKSPACE.CATALOG.LOADING'));
        this.series.say(t('WORKSPACE.CATALOG.LOADING'));
        app.store.onChange(() => this.schedule());
    }

    get el(): HTMLElement {
        return this.page.el;
    }

    focusTarget(): HTMLElement | null {
        return this.hero.firstAction() ?? nav.first(this.page.el);
    }

    show(): void {
        this.visible = true;
        if (!this.started) {
            this.started = true;
            this.startLoads();
        }
        this.renderRecent();
        if (this.dirty) {
            this.dirty = false;
            this.renderCatalog();
        }
        this.hero.start();
        this.page.updateNear();
    }

    hide(): void {
        this.visible = false;
        this.hero.stop();
        this.refresh.clear();
    }

    private schedule(): void {
        if (!this.visible) {
            this.dirty = true;
        } else if (!this.refresh.pending) {
            this.refresh.later(REFRESH_MS, () => this.renderCatalog());
        }
    }

    private startLoads(): void {
        const store = this.app.store;
        store.shelves().then(
            ({ shelves }) => this.platforms.setItems(shelves.map((shelf) => shelf.platform)),
            (error) => this.platforms.setStatus(requestErrorText(error))
        );
        void store.load(['series', 'movie'], undefined, true).then(() => this.schedule());
        this.app.cache.sports(undefined, true).then(
            (data) => this.renderSports(data),
            () => this.events.say(t('WORKSPACE.SPORTS.FAILED'))
        );
    }

    private renderCatalog(): void {
        const store = this.app.store;
        this.hero.setSlides(homeSlides(this.app, this.lead));
        const seed = daySeed();
        const top = rankTopMovies(store.titles('movie'), seed);
        if (top.length > 0) {
            this.top10.setItems(top, true);
        }
        const picks = pickSeriesForYou(store.titles('series'), seed);
        if (picks.length > 0) {
            this.series.fill(
                seriesForYou(picks, {
                    open: (title) => this.app.openTitle(title),
                    start: (title) => this.app.openTitle(title, { autoplay: true }),
                })
            );
        }
        this.keepFocus();
        this.page.updateNear();
    }

    private renderSports(data: SportsData): void {
        const now = new Date();
        this.live = liveCounts(data, now);
        this.leagues.setItems(SPORTS_ROW, true);
        const matches = selectHomeEvents(data.today);
        const rows = matches.map((match) => homeEventRow(match, isLive(match, now)));
        const liveCount = data.today.filter((match) => isLive(match, now)).length;
        if (rows.length === 0) {
            this.events.show(false);
        } else {
            this.events.setNote(
                `${t('WORKSPACE.SPORTS.LIVE_COUNT', { count: liveCount })} · ${
                    data.today.length === 1
                        ? t('WORKSPACE.DASHBOARD.EVENTS_ONE')
                        : t('WORKSPACE.DASHBOARD.EVENTS_COUNT', { count: data.today.length })
                }`
            );
            this.events.fill(eventsList(rows, (row) => this.playEvent(rows, row)));
        }
        this.keepFocus();
        this.page.updateNear();
    }

    private playEvent(rows: readonly HomeEventRow[], row: HomeEventRow): void {
        const items: PlayItem[] = [];
        let index = 0;
        for (const entry of rows) {
            const id = matchStreamId(entry.match);
            if (id === null) {
                continue;
            }
            if (entry === row) {
                index = items.length;
            }
            items.push({
                kind: 'live',
                id,
                title: entry.home && entry.away ? `${entry.home} - ${entry.away}` : entry.title,
                subtitle: `${entry.competition} · ${matchChannel(entry.match)}`,
            });
        }
        if (items.length > 0) {
            this.app.play({ items, index });
        }
    }

    private renderRecent(): void {
        const entries = recentChannels.all();
        this.recent.el.style.display = entries.length > 0 ? '' : 'none';
        this.recent.setItems(entries, true);
    }

    private playRecent(index: number): void {
        const items: PlayItem[] = this.recent.itemList.map((channel) => ({
            kind: 'live',
            id: channel.id,
            title: channel.title,
            subtitle: channel.subtitle,
            logo: channel.logo,
            country: channel.country,
        }));
        this.app.play({ items, index });
    }

    /** A refresh that replaced the focused card: focus its place again. */
    private keepFocus(): void {
        const focused = nav.focused;
        if (this.visible && focused && !document.body.contains(focused)) {
            nav.focus(nav.first(this.page.el));
        }
    }
}
