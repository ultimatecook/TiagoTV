import {
    foldTerm,
    followedTeamOf,
    matchRank,
    MY_TEAMS,
    type CatalogTitle,
    type SportMatch,
    type SportSectionId,
    type TvCountry,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { store } from '../core/storage';
import { rowLabelText } from './labels';
import { toLiveChannel, type LiveChannel } from './live';
import { matchSides } from './sports';

/**
 * Buscar, as the desktop's search page: a term (accents and quotes aside,
 * foldTerm) finds teams (the followed ones, and today's matches), channels
 * ("En vivo"'s countries) and titles (the platforms' catalog), best match
 * first (matchRank). Recent searches stay on this TV.
 */
export type SearchScope = 'all' | 'football' | 'channels' | 'series' | 'movies';

export const MIN_TERM = 2;
const LIMIT = 8;
const RECENT_KEY = 'tiagotv.lite.busquedas';
const RECENT_MAX = 8;

export interface TeamHit {
    readonly name: string;
    readonly sectionId: SportSectionId;
    readonly mine: boolean;
    /** Its match today, if any. */
    readonly match: SportMatch | null;
}

export interface ChannelHit {
    readonly channel: LiveChannel;
    readonly country: string;
    readonly caption: string;
}

function best<T>(items: readonly T[], term: string, textOf: (item: T) => string[]): T[] {
    return items
        .map((item) => {
            const ranks = textOf(item)
                .map((text) => matchRank(text, term))
                .filter((rank) => rank >= 0);
            return { item, rank: ranks.length > 0 ? Math.min.apply(null, ranks) : -1 };
        })
        .filter((entry) => entry.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => entry.item);
}

export function searchTeams(query: string, matches: readonly SportMatch[]): TeamHit[] {
    const term = foldTerm(query);
    const hits: TeamHit[] = [];
    const seen = new Set<string>();
    const add = (name: string, sectionId: SportSectionId, match: SportMatch | null) => {
        const key = foldTerm(name);
        if (!seen.has(key)) {
            seen.add(key);
            hits.push({ name, sectionId, match, mine: followedTeamOf(name) !== null });
        }
    };
    for (const team of best(MY_TEAMS, term, (entry) => [entry.name].concat(entry.aliases ? entry.aliases.slice() : []))) {
        const match = matches.find((entry) => followedTeamOf(entry.event.home) === team || followedTeamOf(entry.event.away) === team) ?? null;
        add(team.name, team.sectionId, match);
    }
    for (const match of matches) {
        const { home, away } = matchSides(match);
        for (const name of [home, away]) {
            if (name && matchRank(name, term) >= 0) {
                add(name, match.sectionId, match);
            }
        }
    }
    return hits.slice(0, LIMIT);
}

export function searchChannels(query: string, countries: readonly TvCountry[]): ChannelHit[] {
    const term = foldTerm(query);
    const all: ChannelHit[] = [];
    for (const country of countries) {
        for (const row of country.rows) {
            for (const group of row.channels) {
                all.push({ channel: toLiveChannel(group), country: country.definition.id, caption: rowLabelText(row.label) });
            }
        }
    }
    const seen = new Set<number>();
    return best(all, term, (hit) => [hit.channel.title])
        .filter((hit) => {
            if (seen.has(hit.channel.streamId)) {
                return false;
            }
            seen.add(hit.channel.streamId);
            return true;
        })
        .slice(0, LIMIT);
}

export function searchTitles(query: string, titles: readonly CatalogTitle[]): CatalogTitle[] {
    const term = foldTerm(query);
    return best(titles, term, (title) => [title.title].concat(title.versions.map((version) => version.title))).slice(0, LIMIT);
}

export function recentSearches(): string[] {
    const value = store.read<string[]>(RECENT_KEY, []);
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

export function rememberSearch(query: string): void {
    const term = query.trim();
    if (term.length < MIN_TERM) {
        return;
    }
    const list = recentSearches().filter((entry) => foldTerm(entry) !== foldTerm(term));
    list.unshift(term);
    store.write(RECENT_KEY, list.slice(0, RECENT_MAX));
}
