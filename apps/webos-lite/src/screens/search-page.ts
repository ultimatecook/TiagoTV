import type { CatalogTitle, TvCountry } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h, picture } from '../core/dom';
import { nav, onActivate } from '../core/nav';
import { Slot } from '../core/timers';
import { tmdbSized } from '../data/images';
import { LIVE_COUNTRIES } from '../data/live';
import {
    MIN_TERM,
    recentSearches,
    rememberSearch,
    searchChannels,
    searchTeams,
    searchTitles,
    type ChannelHit,
    type SearchScope,
    type TeamHit,
} from '../data/search';
import type { SportsData } from '../data/sports';
import { t, type StringKey } from '../data/strings';
import { kindLabel, posterMeta } from '../data/title-meta';
import type { App, PlayItem } from '../app';
import { channelThumb } from '../ui/cards';
import { icon } from '../ui/icons';
import { keyboard } from '../ui/keyboard';
import { crest } from '../ui/crest';
import { PREFETCH } from '../core/request-queue';
import { VPage } from '../ui/vpage';
import type { Page } from './shell';
import { playMatches } from './sports-play';

/**
 * Buscar, as the desktop's: the field, the scopes (Todo · Fútbol · Canales
 * · Series · Películas), and the results grouped (Equipos, Canales, Series
 * y películas). The remote types on the keyboard on the left; the results
 * fill the right as the term settles. Recent searches show while the field
 * is empty.
 */
const SCOPES: readonly (readonly [SearchScope, StringKey])[] = [
    ['all', 'WORKSPACE.SEARCH.SCOPE_ALL'],
    ['football', 'WORKSPACE.SEARCH.SCOPE_FOOTBALL'],
    ['channels', 'WORKSPACE.SEARCH.SCOPE_CHANNELS'],
    ['series', 'WORKSPACE.SEARCH.SCOPE_SERIES'],
    ['movies', 'WORKSPACE.SEARCH.SCOPE_MOVIES'],
];
const SETTLE_MS = 400;

function result(thumb: HTMLElement, title: string, meta: string, kind: string): HTMLElement {
    return h(
        'div',
        'result',
        thumb,
        h('span', 'result__text', h('span', { className: 'result__title', text: title }), h('span', { className: 'result__meta', text: meta })),
        h('span', { className: 'result__kind', text: kind })
    );
}

export class SearchPage implements Page {
    readonly el: HTMLElement;
    private readonly field = h('div', 'search__text');
    private readonly scopesEl = h('div', 'chips search__scopes');
    private readonly results = new VPage('search__results', 0, false);
    private readonly settle = new Slot('search');
    private query = '';
    private scope: SearchScope = 'all';
    private sports: SportsData | null = null;
    private countries: TvCountry[] = [];
    private loadingCountries = false;

    constructor(private readonly app: App) {
        const board = keyboard(
            {
                type: (text) => this.setQuery(this.query + text),
                erase: () => this.setQuery(this.query.slice(0, -1)),
                clear: () => this.setQuery(''),
            },
            t('WORKSPACE.SEARCH.CLEAR')
        );
        this.el = h(
            'div',
            'page page--search',
            h('div', 'search__field', icon('search'), this.field),
            this.scopesEl,
            h('div', 'search__keyboard', board),
            this.results.el
        );
        this.renderScopes();
        this.render();
        app.store.onChange(() => {
            if (this.query.length >= MIN_TERM) {
                this.settle.later(SETTLE_MS * 3, () => this.render());
            }
        });
    }

    focusTarget(): HTMLElement | null {
        return nav.first(this.el.querySelector('.keyboard') as HTMLElement);
    }

    show(): void {
        this.results.updateNear();
    }

    hide(): void {
        this.settle.clear();
    }

    private renderScopes(): void {
        const focusedIndex = nav.focused && this.scopesEl.contains(nav.focused) ? Array.prototype.indexOf.call(this.scopesEl.children, nav.focused) : -1;
        clear(this.scopesEl);
        SCOPES.forEach(([id, key], index) => {
            const chip = h('div', { className: `chip${id === this.scope ? ' is-selected' : ''}`, text: t(key) });
            this.scopesEl.appendChild(
                onActivate(chip, () => {
                    this.scope = id;
                    this.renderScopes();
                    this.render();
                })
            );
            if (index === focusedIndex) {
                nav.focus(chip);
            }
        });
    }

    private setQuery(query: string): void {
        this.query = query;
        this.field.textContent = query || t('WORKSPACE.SEARCH.PLACEHOLDER');
        this.field.classList.toggle('is-empty', !query);
        this.settle.later(SETTLE_MS, () => {
            rememberSearch(query);
            this.render();
        });
    }

    private wants(kind: 'teams' | 'channels' | 'titles'): boolean {
        const scope = this.scope;
        return scope === 'all' || (kind === 'teams' ? scope === 'football' : kind === 'channels' ? scope === 'channels' : scope === 'series' || scope === 'movies');
    }

    /** The catalogs a search reads, loaded once in the background. */
    private prepare(): void {
        if (this.wants('titles')) {
            void this.app.store.load(['movie', 'series'], undefined, PREFETCH);
        }
        if (this.wants('teams') && !this.sports) {
            this.app.sports.refresh().then((data) => {
                this.sports = data;
                this.render();
            }, () => undefined);
        }
        if (this.wants('channels') && !this.loadingCountries) {
            this.loadingCountries = true;
            void LIVE_COUNTRIES.reduce(
                (previous, country) =>
                    previous.then(() =>
                        this.app.cache.country(country.id).then(
                            (loaded) => {
                                if (loaded.country) {
                                    this.countries.push(loaded.country);
                                    this.render();
                                }
                            },
                            () => undefined
                        )
                    ),
                Promise.resolve()
            );
        }
    }

    private render(): void {
        const content = this.results.content;
        const focusedHere = !!nav.focused && content.contains(nav.focused);
        clear(content);
        if (this.query.trim().length < MIN_TERM) {
            this.field.textContent = this.query || t('WORKSPACE.SEARCH.PLACEHOLDER');
            this.renderRecent(content);
            return;
        }
        this.prepare();
        let count = 0;
        if (this.wants('teams')) {
            count += this.group(content, t('WORKSPACE.SEARCH.GROUP_TEAMS'), searchTeams(this.query, this.sports ? this.sports.today : []), (hit) => this.teamRow(hit));
        }
        if (this.wants('channels')) {
            const hits = searchChannels(this.query, this.countries);
            count += this.group(content, t('WORKSPACE.SEARCH.GROUP_CHANNELS'), hits, (hit, index) => this.channelRow(hits, hit, index));
        }
        if (this.wants('titles')) {
            const kinds = this.scope === 'movies' ? ['movie'] : this.scope === 'series' ? ['series'] : ['movie', 'series'];
            const titles: CatalogTitle[] = [];
            kinds.forEach((kind) => titles.push(...this.app.store.titles(kind as 'movie' | 'series')));
            count += this.group(content, t('WORKSPACE.SEARCH.GROUP_TITLES'), searchTitles(this.query, titles), (title) => this.titleRow(title));
        }
        if (count === 0) {
            content.appendChild(h('p', { className: 'search__empty', text: t('WORKSPACE.SEARCH.NO_RESULTS', { query: this.query.trim() }) }));
            content.appendChild(h('p', { className: 'search__hint', text: t('WORKSPACE.SEARCH.NO_RESULTS_HINT') }));
        }
        if (focusedHere) {
            nav.focus(nav.first(content) ?? this.focusTarget());
        }
        this.results.scrollTo(0);
    }

    private renderRecent(content: HTMLElement): void {
        content.appendChild(h('p', { className: 'search__hint', text: t('WORKSPACE.SEARCH.HINT') }));
        const recent = recentSearches();
        if (recent.length > 0) {
            const chips = h('div', 'search__recent');
            for (const term of recent) {
                chips.appendChild(onActivate(h('div', { className: 'chip', text: term }), () => this.setQuery(term)));
            }
            content.appendChild(chips);
        }
    }

    private group<T>(content: HTMLElement, title: string, hits: readonly T[], row: (hit: T, index: number) => HTMLElement): number {
        if (hits.length === 0) {
            return 0;
        }
        const list = h('div', 'results');
        hits.forEach((hit, index) => list.appendChild(row(hit, index)));
        content.appendChild(h('section', 'search__group', h('h2', { className: 'search__group-title', text: title }), list));
        return hits.length;
    }

    private teamRow(hit: TeamHit): HTMLElement {
        const meta = hit.match ? `${hit.match.event.competition} · ${hit.match.event.title}` : '';
        const kind = hit.mine ? t('WORKSPACE.SEARCH.MY_TEAM') : '';
        return onActivate(result(crest(hit.name, 'crest crest--small result__thumb', hit.sectionId), hit.name, meta, kind), () =>
            hit.match ? playMatches(this.app, [hit.match], hit.match) : this.app.openLeague(hit.sectionId)
        );
    }

    private channelRow(hits: readonly ChannelHit[], hit: ChannelHit, index: number): HTMLElement {
        const country = LIVE_COUNTRIES.find((entry) => entry.id === hit.country);
        const thumb = channelThumb(hit.channel.title, hit.channel.logo, 'result__thumb result__thumb--channel');
        return onActivate(result(thumb, hit.channel.title, `${country ? country.name : ''} · ${hit.caption}`, ''), () => {
            const items: PlayItem[] = hits.map((entry) => ({
                kind: 'live',
                id: entry.channel.streamId,
                title: entry.channel.title,
                subtitle: entry.caption,
                logo: entry.channel.logo,
                country: entry.country,
            }));
            this.app.play({ items, index });
        });
    }

    private titleRow(title: CatalogTitle): HTMLElement {
        const thumb = picture(tmdbSized(title.poster, 'w185'), 'result__thumb result__thumb--poster', '');
        return onActivate(result(thumb, title.title, posterMeta(title), kindLabel(title.kind)), () => this.app.openTitle(title));
    }
}
