import {
    findSportSection,
    homeEventRow,
    type SportChannel,
    type SportMatch,
    type SportSection,
    type SportSectionId,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h, toggleClass } from '../core/dom';
import type { Action } from '../core/keys';
import { nav, onActivate } from '../core/nav';
import type { Screen } from '../core/screens';
import { assetUrl } from '../data/images';
import { hasTable, leagueTable } from '../data/league-table';
import type { LiveChannel } from '../data/live';
import { isLive, type SportsData } from '../data/sports';
import { t } from '../data/strings';
import type { App, PlayItem } from '../app';
import { ZAP_DELAY_MS } from '../player/controller';
import { Block } from '../ui/block';
import { CARD, channelCard } from '../ui/cards';
import { eventsList } from '../ui/events-list';
import { tableView } from '../ui/league-table-view';
import { featuredMatch } from '../ui/featured-match';
import { Row } from '../ui/row';
import { Stage } from '../ui/stage';
import { BAR_ITEMS, buildTopbar } from '../ui/topbar';
import { VPage } from '../ui/vpage';
import { playMatches } from './sports-play';

/**
 * A competition's page (LaLiga, Premier League…), as the desktop's: its
 * channels' player fills the first screen (OK on a channel plays it there,
 * OK again goes full screen); below, the featured match, "En vivo y más
 * tarde" and the standings from ESPN. The TV does not start a stream on
 * its own: the account's single connection is the viewer's to spend.
 */
function toChannel(channel: SportChannel): LiveChannel {
    return { key: String(channel.streamId), streamId: channel.streamId, title: channel.title, subtitle: null, logo: channel.icon, quality: null };
}

export class LeagueScreen implements Screen {
    readonly el: HTMLElement;
    private readonly page = new VPage('league__page', 130);
    private readonly stage: Stage;
    private readonly channels: Row<SportChannel>;
    private readonly pill = h('div', 'league-pill');
    private readonly lower = h('div', 'league__lower room');
    private readonly matches = new Block(t('WORKSPACE.SPORTS.MATCHES'), 'block--matches');
    private readonly table = new Block(t('WORKSPACE.SPORTS.TABLE'), 'block--table');
    private readonly section: SportSection | null;
    private playingId: number | null = null;

    constructor(
        private readonly app: App,
        private readonly sectionId: SportSectionId
    ) {
        this.section = findSportSection(sectionId);
        this.stage = new Stage(app, {
            onItem: (item) => this.markPlaying(item),
            setBare: (bare) => toggleClass(this.el, 'is-bare', bare),
        });
        this.channels = new Row<SportChannel>({
            title: t('WORKSPACE.SPORTS.CHANNELS').toUpperCase(),
            variant: 'channels',
            cardWidth: CARD.channel.width,
            gap: CARD.channel.gap,
            render: (channel) => channelCard(toChannel(channel), this.section ? this.section.title : '', channel.streamId === this.playingId),
            activate: (_, index) => this.play(index),
        });
        const top = h('div', { className: 'league__top', attrs: { 'data-anchor': '' } }, h('div', 'live__now', this.stage.title, this.stage.subtitle));
        this.page.add(top);
        this.page.add(this.channels, top);
        this.page.add(this.lower);
        this.lower.appendChild(h('div', 'league__featured'));
        this.lower.appendChild(h('div', 'league__columns', this.matches.el, hasTable(sectionId) ? this.table.el : null));
        this.stage.title.textContent = this.section ? this.section.title : '';
        this.stage.subtitle.textContent = t('WORKSPACE.SPORTS.LOADING');
        this.channels.setStatus(t('WORKSPACE.SPORTS.LOADING'));
        this.matches.say(t('WORKSPACE.SPORTS.LOADING'));
        this.table.say(t('WORKSPACE.SPORTS.TABLE_LOADING'));
        this.el = h(
            'div',
            'screen league-page',
            this.stage.el,
            h('div', 'live__veil'),
            this.page.el,
            this.pill,
            h('div', 'shell__veil'),
            buildTopbar(BAR_ITEMS, 'sports', false).el
        );
        this.renderPill(0);
        void this.load();
    }

    initialFocus(): HTMLElement | null {
        return this.channels.enter() ?? nav.first(this.page.el);
    }

    onHide(): void {
        if (!this.stage.handingOff) {
            this.stage.stop();
            this.markPlaying(null);
        }
    }

    destroy(): void {
        this.stage.stop();
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

    private renderPill(live: number): void {
        const section = this.section;
        const logo = section ? assetUrl(section.logo) : null;
        this.pill.innerHTML = '';
        if (logo) {
            this.pill.appendChild(h('img', { className: 'league-pill__logo', attrs: { src: logo, alt: '' } }));
        }
        this.pill.appendChild(h('span', { className: 'league-pill__name', text: section ? section.title : '' }));
        if (live > 0) {
            this.pill.appendChild(h('span', 'league-pill__live', h('i', 'dot'), t('WORKSPACE.SPORTS.LIVE_COUNT', { count: live })));
        }
    }

    private async load(): Promise<void> {
        let data: SportsData;
        try {
            data = await this.app.cache.sports();
        } catch {
            this.channels.setStatus(t('WORKSPACE.SPORTS.FAILED'), () => void this.load());
            return;
        }
        const content = data.catalog[this.sectionId];
        const now = new Date();
        const matches = content ? content.matches.slice() : [];
        const live = matches.filter((match) => isLive(match, now));
        this.renderPill(live.length);
        this.stage.subtitle.textContent = t('WORKSPACE.SPORTS.MATCHES_COUNT', { live: live.length, later: matches.length - live.length });
        const channels = content ? content.channels : [];
        if (channels.length > 0) {
            this.channels.setItems(channels);
        } else {
            this.channels.setStatus(t('WORKSPACE.SPORTS.NO_MATCHES'));
        }
        this.renderMatches(matches, now);
        if (nav.focused && !document.body.contains(nav.focused)) {
            nav.focus(this.initialFocus());
        }
        if (hasTable(this.sectionId)) {
            const table = await leagueTable(this.sectionId);
            this.table.fill(table ? tableView(table, this.section) : null);
            this.table.show(!!table);
        }
        this.page.updateNear();
    }

    private renderMatches(matches: readonly SportMatch[], now: Date): void {
        const featured = this.lower.firstChild as HTMLElement;
        featured.innerHTML = '';
        if (matches.length === 0) {
            this.matches.say(t('WORKSPACE.SPORTS.NO_MATCHES'));
            return;
        }
        const first = matches[0];
        featured.appendChild(onActivate(featuredMatch(first, this.section, now), () => playMatches(this.app, matches, first)));
        const rows = matches.map((match) => homeEventRow(match, isLive(match, now)));
        this.matches.setNote(t('WORKSPACE.SPORTS.MATCHES_COUNT', { live: rows.filter((row) => row.live).length, later: rows.filter((row) => !row.live).length }));
        this.matches.fill(eventsList(rows, (row) => playMatches(this.app, matches, row.match)));
    }

    private items(): PlayItem[] {
        const title = this.section ? this.section.title : '';
        return this.channels.itemList.map((channel) => ({
            kind: 'live',
            id: channel.streamId,
            title: channel.title,
            subtitle: title,
            logo: channel.icon,
        }));
    }

    private play(index: number): void {
        this.stage.play({ items: this.items(), index, onIndexChange: (next) => nav.focus(this.channels.cardAt(next)) });
    }

    private markPlaying(item: PlayItem | null): void {
        this.playingId = item ? item.id : null;
        this.channels.eachCard((card, channel) => toggleClass(card, 'is-playing', channel.streamId === this.playingId));
    }
}
