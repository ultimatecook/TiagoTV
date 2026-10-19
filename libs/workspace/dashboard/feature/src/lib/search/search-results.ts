import {
    categoryLanguageCode,
    displayTitle,
    isSpanishOrEnglishCategory,
} from '@iptvnator/shared/interfaces';
import type { TvCountry } from '../countries/countries-catalog';
import type { RowLabel } from '../countries/country-rows';
import { STREAMING_PLATFORMS } from '../platforms/streaming-platforms';
import {
    followedTeamOf,
    MY_TEAMS,
    type FollowedTeam,
} from '../sports/my-teams';
import type { SportSectionId } from '../sports/sport-sections';
import type { SportMatch } from '../sports/sports-catalog';
import { teamDisplayName, teamKey } from '../sports/team-names';

/**
 * TiagoTV's search page (handoff 05 · Buscador): what a term finds in the
 * source, grouped as the page shows it. Teams come from the sports catalog
 * (today's and upcoming matches, and the followed teams), channels from
 * "En vivo"'s countries, titles from the Xtream catalog. Everything here is
 * pure; the page and its service feed it.
 */
export type SearchScope = 'all' | 'football' | 'channels' | 'series' | 'movies';

export const SEARCH_SCOPES: readonly {
    readonly id: SearchScope;
    readonly labelKey: string;
}[] = [
    { id: 'all', labelKey: 'WORKSPACE.SEARCH.SCOPE_ALL' },
    { id: 'football', labelKey: 'WORKSPACE.SEARCH.SCOPE_FOOTBALL' },
    { id: 'channels', labelKey: 'WORKSPACE.SEARCH.SCOPE_CHANNELS' },
    { id: 'series', labelKey: 'WORKSPACE.SEARCH.SCOPE_SERIES' },
    { id: 'movies', labelKey: 'WORKSPACE.SEARCH.SCOPE_MOVIES' },
];

/** Shorter terms match too much to be worth a catalog query. */
export const SEARCH_MIN_LENGTH = 2;

/** "Atlético", "Newell's" → "atletico", "newells": accents and quotes go. */
export function foldTerm(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/['’`´.]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * How well `text` answers `term` (both folded): 0 when it starts with it,
 * 1 when a word does, 2 when it only contains it, -1 when it does not.
 */
export function matchRank(text: string, term: string): number {
    const folded = foldTerm(text);
    if (!term || !folded.includes(term)) {
        return -1;
    }
    if (folded.startsWith(term)) {
        return 0;
    }
    return folded.includes(` ${term}`) ? 1 : 2;
}

/** The best rank of any of `texts`, -1 when none matches. */
function bestRank(texts: readonly string[], term: string): number {
    const ranks = texts
        .map((text) => matchRank(text, term))
        .filter((rank) => rank >= 0);
    return ranks.length > 0 ? Math.min(...ranks) : -1;
}

// ─── Teams ─────────────────────────────────────────────────────────────────
export interface TeamHit {
    readonly key: string;
    readonly name: string;
    readonly sectionId: SportSectionId;
    /** The followed team ("Mi equipo") the name is, if any. */
    readonly followed: FollowedTeam | null;
    /** Its next match: on now, or the soonest to come. */
    readonly match: SportMatch | null;
    readonly opponent: string | null;
    readonly live: boolean;
    readonly rank: number;
}

/** Sections whose events have no two sides. */
const NO_SIDES = new Set<SportSectionId>(['tennis', 'motor']);

/**
 * The teams named like `term` (folded): the sides of `matches` (in their
 * order, the ones on now first), then the followed teams without a match.
 * One entry per team and competition, best match first.
 */
export function findTeams(
    matches: readonly SportMatch[],
    term: string,
    isLive: (match: SportMatch) => boolean,
    limit = 8
): TeamHit[] {
    if (!term) {
        return [];
    }
    const hits = new Map<string, TeamHit>();
    for (const match of matches) {
        if (NO_SIDES.has(match.sectionId)) {
            continue;
        }
        const { home, away } = match.event;
        for (const [side, other] of [
            [home, away],
            [away, home],
        ] as const) {
            if (!side) {
                continue;
            }
            const name = teamDisplayName(side);
            const rank = bestRank([name, side], term);
            const key = `${match.sectionId}:${teamKey(side)}`;
            if (rank < 0 || hits.has(key)) {
                continue;
            }
            hits.set(key, {
                key,
                name,
                sectionId: match.sectionId,
                followed: followedTeamOf(side),
                match,
                opponent: other ? teamDisplayName(other) : null,
                live: isLive(match),
                rank,
            });
        }
    }
    const listed = [...hits.values()];
    for (const team of MY_TEAMS) {
        const rank = bestRank([team.name, ...(team.aliases ?? [])], term);
        if (rank < 0 || listed.some((hit) => hit.followed === team)) {
            continue;
        }
        listed.push({
            key: `${team.sectionId}:${teamKey(team.name)}`,
            name: team.name,
            sectionId: team.sectionId,
            followed: team,
            match: null,
            opponent: null,
            live: false,
            rank,
        });
    }
    return listed
        .map((hit, order) => ({ hit, order }))
        .sort(
            (a, b) =>
                a.hit.rank - b.hit.rank ||
                Number(b.hit.live) - Number(a.hit.live) ||
                Number(!!b.hit.followed) - Number(!!a.hit.followed) ||
                a.order - b.order
        )
        .slice(0, limit)
        .map(({ hit }) => hit);
}

// ─── Channels ──────────────────────────────────────────────────────────────
export interface ChannelHit {
    readonly key: string;
    readonly title: string;
    readonly subtitle: string | null;
    readonly icon: string | null;
    readonly countryId: string;
    readonly countryNameKey: string;
    readonly flag: string;
    readonly row: RowLabel;
    readonly streamId: number;
    readonly categoryId: string;
    readonly rank: number;
}

/**
 * The live channels named like `term`, from the kept countries (Argentina,
 * Spain, the United Kingdom, the United States), each once per country.
 */
export function findChannels(
    countries: readonly TvCountry[],
    term: string,
    limit = 8
): { hits: ChannelHit[]; total: number } {
    if (!term) {
        return { hits: [], total: 0 };
    }
    const seen = new Set<string>();
    const hits: ChannelHit[] = [];
    for (const country of countries) {
        for (const row of country.rows) {
            for (const channel of row.channels) {
                const key = `${country.definition.id}:${channel.key}`;
                const rank = matchRank(channel.title, term);
                const copy = channel.copies[0];
                if (rank < 0 || !copy || seen.has(key)) {
                    continue;
                }
                seen.add(key);
                hits.push({
                    key,
                    title: channel.title,
                    subtitle: channel.subtitle,
                    icon: channel.icons[0] ?? copy.icon,
                    countryId: country.definition.id,
                    countryNameKey: country.definition.nameKey,
                    flag: country.definition.flag,
                    row: row.label,
                    streamId: copy.streamId,
                    categoryId: copy.categoryId,
                    rank,
                });
            }
        }
    }
    const ranked = hits
        .map((hit, order) => ({ hit, order }))
        .sort((a, b) => a.hit.rank - b.hit.rank || a.order - b.order)
        .map(({ hit }) => hit);
    return { hits: ranked.slice(0, limit), total: ranked.length };
}

// ─── Series and movies ─────────────────────────────────────────────────────
export type TitleKind = 'movie' | 'series';

/** What the Xtream catalog search answers with (both runtimes). */
export interface TitleSearchItem {
    readonly category_id: number | string;
    readonly title?: string;
    readonly name?: string;
    readonly xtream_id: number;
    readonly poster_url?: string | null;
    readonly release_year?: number | null;
}

export interface TitleHit {
    readonly key: string;
    readonly kind: TitleKind;
    readonly title: string;
    readonly year: number | null;
    readonly platform: string | null;
    readonly poster: string | null;
    readonly categoryId: string;
    readonly xtreamId: number;
    readonly rank: number;
}

/**
 * The categories a kind keeps (Spanish and English, see
 * `isSpanishOrEnglishCategory`): a catalog that tags none of its categories
 * with a language is not filtered, so it never comes out empty.
 */
export function languageFilter(
    names: ReadonlyMap<string, string>,
    kind: TitleKind
): (categoryId: string) => boolean {
    const tagged = [...names.values()].some(
        (name) => categoryLanguageCode(name) !== null
    );
    if (!tagged) {
        return () => true;
    }
    const contentKind = kind === 'movie' ? 'vod' : 'series';
    return (categoryId) => {
        const name = names.get(categoryId);
        return !!name && isSpanishOrEnglishCategory(name, contentKind);
    };
}

/** The year a provider marks on a name: "DARK (2017)_ENG", "Fauda [2015]". */
const MARKED_YEAR = /[([]\s*((?:19|20)\d{2})\s*[)\]]/;

/**
 * The catalog's answers as the page lists them: the kept languages only,
 * one per title (a show filed in Spanish and English shows once), the
 * titles that start with the term first.
 */
export function toTitleHits(
    items: readonly TitleSearchItem[],
    kind: TitleKind,
    categoryNames: ReadonlyMap<string, string>,
    term: string
): TitleHit[] {
    const kept = languageFilter(categoryNames, kind);
    const seen = new Set<string>();
    const hits: TitleHit[] = [];
    for (const item of items) {
        const categoryId = String(item.category_id ?? '');
        const raw = String(item.title || item.name || '').trim();
        if (!raw || !kept(categoryId)) {
            continue;
        }
        // The name as the show is called: no year or language tags.
        const title = displayTitle(raw);
        const markedYear = MARKED_YEAR.exec(raw);
        const key = `${kind}:${foldTerm(title)}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const category = categoryNames.get(categoryId) ?? '';
        const rank = matchRank(title, term);
        hits.push({
            key,
            kind,
            title,
            year:
                item.release_year ??
                (markedYear ? Number(markedYear[1]) : null),
            platform:
                STREAMING_PLATFORMS.find((platform) =>
                    platform.category.test(category)
                )?.name ?? null,
            poster: item.poster_url || null,
            categoryId,
            xtreamId: item.xtream_id,
            rank: rank < 0 ? 3 : rank,
        });
    }
    return hits
        .map((hit, order) => ({ hit, order }))
        .sort((a, b) => a.hit.rank - b.hit.rank || a.order - b.order)
        .map(({ hit }) => hit);
}
