import {
    parseEspnTable,
    parseLeagueTable,
    type LeagueTable,
} from './league-table-sources';
import type { SportsApiClient } from './sports-api-client';
import type { SportSectionId } from './sport-sections';

export {
    parseEspnTable,
    parseLeagueTable,
    zoneOf,
    type FormResult,
    type LeagueTable,
    type LeagueTableGroup,
    type LeagueTableRow,
    type TableZone,
} from './league-table-sources';

/**
 * A league page's standings (see league-table-sources): ESPN's table,
 * else TheSportsDB's, each through its throttled client. Answers, empty
 * ones included, are kept a few hours in this browser's storage; a failed
 * request is tried again on the next visit, and a fallback answer given
 * while ESPN failed is kept for this session only.
 */
interface TableLeague {
    /** The league on ESPN ("esp.1"). */
    readonly espn: string;
    /** The league's id on TheSportsDB. */
    readonly id: string;
    /** Played within a calendar year ("2026"), not across two ("2026-2027"). */
    readonly calendarYear?: boolean;
}

/** The sections with a league table; the others have none. */
const TABLE_LEAGUES: Partial<Record<SportSectionId, TableLeague>> = {
    laliga: { espn: 'esp.1', id: '4335' },
    'premier-league': { espn: 'eng.1', id: '4328' },
    'liga-argentina': { espn: 'arg.1', id: '4406', calendarYear: true },
    'champions-league': { espn: 'uefa.champions', id: '4480' },
    'europa-league': { espn: 'uefa.europa', id: '4481' },
    libertadores: {
        espn: 'conmebol.libertadores',
        id: '4501',
        calendarYear: true,
    },
    mls: { espn: 'usa.1', id: '4346', calendarYear: true },
    hypermotion: { espn: 'esp.2', id: '4400' },
    'serie-a': { espn: 'ita.1', id: '4332' },
    bundesliga: { espn: 'ger.1', id: '4331' },
    'ligue-1': { espn: 'fra.1', id: '4334' },
    eredivisie: { espn: 'ned.1', id: '4337' },
};

// v2: v1 held TheSportsDB's five-row tables. v3: v2 kept one group of a
// table in groups (no switch to the others).
const CACHE_KEY = 'tiagotv:league-tables:v3';
const HIT_TTL_MS = 3 * 60 * 60 * 1000;
const MISS_TTL_MS = 6 * 60 * 60 * 1000;

export function hasLeagueTable(sectionId: SportSectionId): boolean {
    return sectionId in TABLE_LEAGUES;
}

/** The season under way: "2026-2027" from July, "2026" for a calendar one. */
export function seasonOf(sectionId: SportSectionId, now: Date): string | null {
    const league = TABLE_LEAGUES[sectionId];
    if (!league) {
        return null;
    }
    const year = now.getFullYear();
    if (league.calendarYear) {
        return String(year);
    }
    const first = now.getMonth() >= 6 ? year : year - 1;
    return `${first}-${first + 1}`;
}

interface CacheEntry {
    readonly season: string;
    readonly at: number;
    readonly table: LeagueTable | null;
}

/** A table, and whether it may be stored (ESPN answered). */
interface Answer {
    readonly table: LeagueTable | null;
    readonly lasting: boolean;
}

export interface LeagueTableDeps {
    readonly espn: Pick<SportsApiClient, 'get'>;
    readonly sportsDb: Pick<SportsApiClient, 'get'>;
    readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
    readonly now?: () => number;
    /** A team the viewer follows: its group shows first. */
    readonly preferred?: (team: string) => boolean;
}

export class LeagueTableResolver {
    private readonly cache: Record<string, CacheEntry>;
    /** Fallback answers given while ESPN failed: this session's only. */
    private readonly session = new Map<string, CacheEntry>();
    private readonly pending = new Map<string, Promise<LeagueTable | null>>();

    constructor(private readonly deps: LeagueTableDeps) {
        this.cache = readCache(deps.storage);
    }

    /** The section's table, or null when it has none (or it failed). */
    table(sectionId: SportSectionId): Promise<LeagueTable | null> {
        const now = this.deps.now?.() ?? Date.now();
        const league = TABLE_LEAGUES[sectionId];
        const season = seasonOf(sectionId, new Date(now));
        if (!league || !season) {
            return Promise.resolve(null);
        }
        const cached = this.cache[sectionId] ?? this.session.get(sectionId);
        if (
            cached?.season === season &&
            now - cached.at < (cached.table ? HIT_TTL_MS : MISS_TTL_MS)
        ) {
            return Promise.resolve(cached.table);
        }
        let request = this.pending.get(sectionId);
        if (!request) {
            request = this.ask(league, season)
                .then(({ table, lasting }) => {
                    const entry = { season, at: now, table };
                    if (lasting) {
                        this.cache[sectionId] = entry;
                        writeCache(this.deps.storage, this.cache);
                    } else {
                        this.session.set(sectionId, entry);
                    }
                    return table;
                })
                .catch(() => null)
                .finally(() => this.pending.delete(sectionId));
            this.pending.set(sectionId, request);
        }
        return request;
    }

    /** ESPN's table, else TheSportsDB's; rejects when neither answered. */
    private async ask(league: TableLeague, season: string): Promise<Answer> {
        const preferred = this.deps.preferred;
        let espnFailed = false;
        try {
            const espn = parseEspnTable(
                await this.deps.espn.get(`${league.espn}/standings`),
                preferred
            );
            if (espn) {
                return { table: espn, lasting: true };
            }
        } catch {
            espnFailed = true;
        }
        const fallback = parseLeagueTable(
            await this.deps.sportsDb.get(
                `lookuptable.php?l=${league.id}&s=${season}`
            ),
            preferred
        );
        if (espnFailed && !fallback) {
            throw new Error('No table answered');
        }
        return { table: fallback, lasting: !espnFailed };
    }
}

function readCache(
    storage: LeagueTableDeps['storage']
): Record<string, CacheEntry> {
    try {
        const raw = storage?.getItem(CACHE_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, CacheEntry>)
            : {};
    } catch {
        return {};
    }
}

function writeCache(
    storage: LeagueTableDeps['storage'],
    cache: Record<string, CacheEntry>
): void {
    try {
        storage?.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // A full or blocked storage only costs a repeat request.
    }
}
