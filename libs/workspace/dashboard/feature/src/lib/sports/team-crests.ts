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
/** The free API refuses bursts: one request every 3s stays under it. */
const REQUEST_GAP_MS = 3000;
/** A refused request is tried twice more, after this pause each time. */
const RETRY_AFTER_MS = 25_000;
const RETRIES = 2;
const HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The competition's league on TheSportsDB, to tell same-named clubs apart;
 * the cups (Europa League, Libertadores) and "Resto del mundo" have none.
 */
const LEAGUE_HINTS: Partial<Record<SportSectionId, RegExp>> = {
    'premier-league': /english premier league/i,
    laliga: /spanish la liga$/i,
    hypermotion: /spanish la liga 2|segunda/i,
    'liga-argentina': /argentin/i,
    mls: /major league soccer|\bmls\b/i,
    eredivisie: /dutch eredivisie/i,
    'serie-a': /italian serie a/i,
    'ligue-1': /french ligue 1/i,
    bundesliga: /german bundesliga/i,
    basketball: /\bnba\b|liga acb|euroleague|british basketball/i,
};

/**
 * Names the search cannot answer, looked up by the API's id: names it
 * files otherwise ("Bayern Munich", "Athletic Bilbao"), answers it gives
 * for another sport or side ("Brighton" finds the women's team, the
 * football Nottingham Forest only a netball club) and clubs it misses by
 * the provider's name ("Paris Saint-Germain").
 */
type Alias = { name?: string; id?: string };
const ids = (id: string, ...names: string[]): [string, Alias][] =>
    names.map((name) => [name, { id }]);

function aliasTable(entries: [string, Alias][]): Record<string, Alias> {
    const table: Record<string, Alias> = {};
    for (const [name, alias] of entries) {
        table[name] = alias;
    }
    return table;
}

const ALIASES: Record<string, Alias> = aliasTable([
    ...ids('133619', 'brighton', 'brighton & hove albion'),
    ...ids('133720', 'nottingham forest', "nott'm forest"),
    ...ids('133601', 'aston villa'),
    ...ids('133664', 'bayern münchen', 'fc bayern münchen', 'bayern múnich'),
    ...ids('133651', 'hamburger sv', 'hsv'),
    ...ids('133727', 'athletic club', 'athletic bilbao'),
    ...ids('133729', 'atlético de madrid', 'atletico de madrid'),
    ...ids('133681', 'inter', 'inter de milán', 'inter milan'),
    ...ids('134784', 'hellas verona', 'verona'),
    ...ids('133859', 'pisa', 'pisa sc'),
    ...ids('134224', 'cremonese', 'us cremonese'),
    ...ids('133714', 'paris saint-germain', 'paris sg', 'psg'),
    ...ids('133707', 'olympique de marseille', 'marseille'),
    ...ids('133713', 'olympique lyonnais', 'lyon'),
    ...ids('133711', 'losc lille', 'lille osc', 'lille'),
    ...ids('134709', 'angers sco'),
    ['mainz 05', { name: 'Mainz' }],
    ['1. fsv mainz 05', { name: 'Mainz' }],
]);

/** Basketball sides go by their sponsors' names, and share clubs' names. */
const BASKETBALL_ALIASES: Record<string, Alias> = aliasTable([
    ...ids('135092', 'real madrid'),
    ...ids('135095', 'ucam murcia'),
    ...ids('135086', 'la laguna tenerife', 'tenerife'),
    ...ids('135088', 'kosner baskonia', 'baskonia'),
    ...ids('135081', 'casademont zaragoza', 'zaragoza'),
    ...ids('143918', 'fiatc girona', 'girona'),
    ...ids('144621', 'leyma basquet coruña', 'coruña'),
    ...ids('135080', 'bilbao', 'surne bilbao'),
    ...ids('135096', 'unicaja', 'unicaja málaga'),
    ...ids('135090', 'morabanc andorra', 'andorra'),
]);

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

    /** One API request, spaced from the last; a refusal is retried. */
    private async get(url: string): Promise<unknown> {
        const wait =
            this.deps.wait ??
            ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
        const gap = this.lastRequestAt + REQUEST_GAP_MS - Date.now();
        if (gap > 0) {
            await wait(gap);
        }
        for (let attempt = 0; ; attempt++) {
            this.lastRequestAt = Date.now();
            try {
                return await this.deps.fetchJson(url);
            } catch (error) {
                if (attempt >= RETRIES) {
                    throw error;
                }
                await wait(RETRY_AFTER_MS);
            }
        }
    }

    private async lookup(
        team: string,
        section: SportSectionId | null
    ): Promise<string | null> {
        // A side from the competition's league wins over the first name's
        // answer from elsewhere.
        const alias = (section === 'basketball' ? BASKETBALL_ALIASES : ALIASES)[
            team.trim().toLowerCase()
        ];
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
