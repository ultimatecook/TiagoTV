import type { SportSectionId } from './sport-sections';

/**
 * Team crests for the Home's match cards, from TheSportsDB's free API (no
 * key of ours, CORS-enabled). Provider feeds name teams their own way
 * ("RC Celta", "Stade Rennais FC"), so a name is tried as written, then
 * without club affixes, and the result must be a men's senior side,
 * preferably from the competition's league. Answers, misses included, are
 * cached so a Home visit costs no requests once its teams are known.
 */
const API = 'https://www.thesportsdb.com/api/v1/json/123/';
// v2: v1 kept failed lookups (the API's rate limit) as "no crest".
const CACHE_KEY = 'tiagotv:team-crests:v2';
/** The free API answers about 30 requests a minute: one every 2.2s. */
const REQUEST_GAP_MS = 2200;
/** A refused request is tried once more after this pause. */
const RETRY_AFTER_MS = 20_000;
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const LEAGUE_HINTS: Partial<Record<SportSectionId, RegExp>> = {
    'premier-league': /english premier league/i,
    laliga: /spanish la liga/i,
    'serie-a': /italian serie a/i,
    'ligue-1': /french ligue 1/i,
    bundesliga: /german bundesliga/i,
    basketball: /\bnba\b|liga acb|euroleague|british basketball/i,
};

/**
 * Names the search cannot answer: "Brighton" finds only the women's side,
 * and the football Nottingham Forest only by its id (the search returns a
 * netball club).
 */
const ALIASES: Record<string, { name?: string; id?: string }> = {
    brighton: { name: 'Brighton and Hove Albion' },
    'brighton & hove albion': { name: 'Brighton and Hove Albion' },
    'nottingham forest': { id: '133720' },
    "nott'm forest": { id: '133720' },
    'bayern múnich': { name: 'Bayern Munich' },
    'inter de milán': { name: 'Inter Milan' },
    'atlético de madrid': { name: 'Atlético Madrid' },
};

const CLUB_AFFIXES =
    /\b(fc|cf|rc|ad|sd|cd|ud|sc|ac|as|ss|ssc|us|afc|fk|sk|1\.)\b\.?/gi;
const NOT_SENIOR_MEN =
    /women|wfc|femen|f[ée]minin|ladies|liga f\b|gloriosas|\bu-?\d{2}\b|youth|reserves?\b|\sb$/i;

interface TheSportsDbTeam {
    readonly strTeam?: string;
    readonly strTeamAlternate?: string | null;
    readonly strSport?: string;
    readonly strLeague?: string;
    readonly strBadge?: string | null;
}

interface CacheEntry {
    readonly url: string | null;
    readonly at: number;
}

export interface TeamCrestDeps {
    /** Rejects when the API refuses or fails: that is not a missing crest. */
    readonly fetchJson: (url: string) => Promise<unknown>;
    readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
    readonly now?: () => number;
    readonly wait?: (ms: number) => Promise<void>;
}

export function crestSearchNames(name: string): string[] {
    const stripped = name
        .replace(CLUB_AFFIXES, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return [...new Set([name.trim(), stripped].filter(Boolean))];
}

/**
 * The crest among the search results: a men's senior side of the card's
 * sport (football, or basketball for its card), from the competition's
 * league when one answered ("RC Celta" also finds Gran Peña, Celta's
 * affiliate in a lower league).
 */
export function pickCrest(
    teams: readonly TheSportsDbTeam[],
    section: SportSectionId | null
): { url: string; inLeague: boolean } | null {
    const hint = section ? LEAGUE_HINTS[section] : undefined;
    const candidates = teams.filter(
        (team) =>
            team.strSport ===
                (section === 'basketball' ? 'Basketball' : 'Soccer') &&
            !!team.strBadge &&
            !NOT_SENIOR_MEN.test(
                `${team.strTeam ?? ''} ${team.strLeague ?? ''}`
            )
    );
    const inLeague = hint
        ? candidates.find((team) => hint.test(team.strLeague ?? ''))
        : undefined;
    const team = inLeague ?? candidates[0];
    return team?.strBadge
        ? { url: team.strBadge, inLeague: !!inLeague || !hint }
        : null;
}

export class TeamCrestResolver {
    private readonly cache: Record<string, CacheEntry>;
    private readonly pending = new Map<string, Promise<string | null>>();
    private queue: Promise<unknown> = Promise.resolve();
    private lastRequestAt = 0;

    constructor(private readonly deps: TeamCrestDeps) {
        this.cache = readCache(deps.storage);
    }

    /** The crest URL of `team`, or null when none is known. */
    resolve(
        team: string,
        section: SportSectionId | null
    ): Promise<string | null> {
        const key = `${section ?? '-'}:${team.toLowerCase()}`;
        const cached = this.cache[key];
        const now = this.deps.now?.() ?? Date.now();
        if (
            cached &&
            now - cached.at < (cached.url ? HIT_TTL_MS : MISS_TTL_MS)
        ) {
            return Promise.resolve(cached.url);
        }
        let request = this.pending.get(key);
        if (!request) {
            // One lookup at a time keeps within the free API's rate limit.
            const lookup = this.queue.then(() => this.lookup(team, section));
            this.queue = lookup.catch(() => null);
            // Only an answer is kept; a failed lookup is tried again on the
            // next visit, the card showing initials meanwhile.
            request = lookup
                .then((url) => {
                    this.cache[key] = { url, at: now };
                    writeCache(this.deps.storage, this.cache);
                    return url;
                })
                .catch(() => null)
                .finally(() => this.pending.delete(key));
            this.pending.set(key, request);
        }
        return request;
    }

    /** One API request, spaced from the last; a refusal is retried once. */
    private async get(url: string): Promise<unknown> {
        const wait =
            this.deps.wait ??
            ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
        const gap = this.lastRequestAt + REQUEST_GAP_MS - Date.now();
        if (gap > 0) {
            await wait(gap);
        }
        this.lastRequestAt = Date.now();
        try {
            return await this.deps.fetchJson(url);
        } catch {
            await wait(RETRY_AFTER_MS);
            this.lastRequestAt = Date.now();
            return this.deps.fetchJson(url);
        }
    }

    private async lookup(
        team: string,
        section: SportSectionId | null
    ): Promise<string | null> {
        // A side from the competition's league wins over the first name's
        // answer from elsewhere.
        const alias = ALIASES[team.trim().toLowerCase()];
        if (alias?.id) {
            const body = (await this.get(
                `${API}lookupteam.php?id=${alias.id}`
            )) as { teams?: TheSportsDbTeam[] | null } | null;
            return body?.teams?.[0]?.strBadge ?? null;
        }
        let fallback: string | null = null;
        for (const name of crestSearchNames(alias?.name ?? team)) {
            const body = (await this.get(
                `${API}searchteams.php?t=${encodeURIComponent(name.replace(/\s+/g, '_'))}`
            )) as { teams?: TheSportsDbTeam[] | null } | null;
            const crest = pickCrest(body?.teams ?? [], section);
            if (crest?.inLeague) {
                return crest.url;
            }
            fallback ??= crest?.url ?? null;
        }
        return fallback;
    }
}

function readCache(
    storage: TeamCrestDeps['storage']
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
    storage: TeamCrestDeps['storage'],
    cache: Record<string, CacheEntry>
): void {
    try {
        storage?.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
        // A full or blocked storage only costs repeat lookups.
    }
}
