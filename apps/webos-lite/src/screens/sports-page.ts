import {
    homeEventRow,
    SPORTS_ROW,
    teamFixtures,
    type SportMatch,
    type SportSection,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h } from '../core/dom';
import { nav, onActivate } from '../core/nav';
import { Slot } from '../core/timers';
import { SPORTS_MS } from '../data/catalog-cache';
import { isLive, liveCounts, type SportsData } from '../data/sports';
import { t } from '../data/strings';
import type { App } from '../app';
import { Block } from '../ui/block';
import { CARD, leagueCard } from '../ui/cards';
import { eventsList } from '../ui/events-list';
import { liveMatchCard, teamPill } from '../ui/match-cards';
import { Row } from '../ui/row';
import { VPage } from '../ui/vpage';
import type { Page } from './shell';
import { playMatches } from './sports-play';

/**
 * Deportes, as the desktop's hub: the title (and today), the league cards,
 * "Tus equipos" (Real Madrid, Newell's, West Ham), "En vivo ahora" as
 * cards on the competition's colour and "Más tarde" as a list. While it
 * shows, the board reloads every few minutes: event channels rename
 * themselves as matches start and end.
 */
export class SportsPage implements Page {
    private readonly page = new VPage('page page--sports', 130);
    private readonly leagues: Row<SportSection>;
    private readonly teams = h('div', 'team-pills');
    private readonly live = new Block(t('WORKSPACE.SPORTS.LIVE_NOW'), 'block--live');
    private readonly later = new Block(t('WORKSPACE.SPORTS.LATER'), 'block--later');
    private readonly timer = new Slot('sports-refresh');
    private counts = new Map<string, number>();
    private visible = false;
    private loading = false;

    constructor(private readonly app: App) {
        this.leagues = new Row<SportSection>({
            title: '',
            headless: true,
            variant: 'leagues',
            cardWidth: CARD.league.width,
            gap: CARD.league.gap,
            render: (section) => leagueCard(section, this.counts.get(section.id) ?? 0),
            activate: (section) => app.openLeague(section.id),
        });
        this.leagues.setItems(SPORTS_ROW);
        this.page.add(
            h(
                'div',
                'page__head',
                h('h1', { className: 'page__title', text: t('WORKSPACE.SPORTS.TITLE') }),
                h('span', { className: 'page__day', text: t('WORKSPACE.SPORTS.DAYS.TODAY') })
            )
        );
        this.page.add(this.leagues);
        this.page.add(this.teams);
        this.page.add(this.live.el);
        this.page.add(this.later.el);
        this.live.say(t('WORKSPACE.SPORTS.LOADING'));
        this.later.show(false);
    }

    get el(): HTMLElement {
        return this.page.el;
    }

    show(): void {
        this.visible = true;
        this.page.updateNear();
        const cached = this.app.cache.sportsNow();
        if (cached) {
            void cached.then((data) => this.render(data), () => undefined);
        }
        this.schedule(cached ? SPORTS_MS : 250);
    }

    hide(): void {
        this.visible = false;
        this.timer.clear();
    }

    private schedule(delay: number): void {
        this.timer.later(delay, () => {
            if (this.visible) {
                void this.load();
            }
        });
    }

    private async load(): Promise<void> {
        if (this.loading) {
            return;
        }
        this.loading = true;
        try {
            this.render(await this.app.cache.sports());
        } catch {
            this.live.say(t('WORKSPACE.SPORTS.FAILED'));
        } finally {
            this.loading = false;
            if (this.visible) {
                this.schedule(SPORTS_MS);
            }
        }
    }

    private render(data: SportsData): void {
        const now = new Date();
        const focused = nav.focused;
        this.counts = liveCounts(data, now);
        this.leagues.setItems(SPORTS_ROW, true);
        this.renderTeams(data.today, now);
        const live = data.today.filter((match) => isLive(match, now));
        const later = data.today.filter((match) => !isLive(match, now));
        if (live.length === 0 && later.length === 0) {
            this.live.say(t('WORKSPACE.SPORTS.NO_MATCHES'));
        } else {
            const grid = h('div', 'match-grid');
            for (const match of live) {
                grid.appendChild(onActivate(liveMatchCard(match, now), () => playMatches(this.app, live, match)));
            }
            this.live.show(live.length > 0);
            this.live.fill(grid);
        }
        this.later.show(later.length > 0);
        const rows = later.map((match) => homeEventRow(match, false));
        this.later.fill(eventsList(rows, (row) => playMatches(this.app, later, row.match)));
        if (focused && !document.body.contains(focused) && this.visible) {
            nav.focus(nav.first(this.page.el));
        }
        this.page.updateNear();
    }

    private renderTeams(today: readonly SportMatch[], now: Date): void {
        clear(this.teams);
        for (const fixture of teamFixtures(today.slice())) {
            const pill = teamPill(fixture, now);
            const match = fixture.match;
            this.teams.appendChild(
                onActivate(pill, () => (match ? playMatches(this.app, [match], match) : this.app.openLeague(fixture.team.sectionId)))
            );
        }
    }
}
