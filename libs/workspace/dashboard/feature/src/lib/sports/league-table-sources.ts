/**
 * A league page's standings, from the APIs that publish them: ESPN's
 * public site API (`<slug>/standings`: the whole table, its zones, no
 * form) first, TheSportsDB's `lookuptable.php` (the free key's top five
 * rows, with form) when ESPN fails or has none. Both answer the same
 * model; a table in groups shows the one holding a followed team, and
 * keeps the others for the page to switch to.
 */
export type TableZone =
    'champions' | 'europe' | 'promotion' | 'playoff' | 'relegation';
export type FormResult = 'W' | 'D' | 'L';

export interface LeagueTableRow {
    readonly rank: number;
    readonly team: string;
    readonly badge: string | null;
    readonly played: number;
    readonly points: number;
    /** The last results, as the API lists them; empty when it gives none. */
    readonly form: readonly FormResult[];
    readonly zone: TableZone | null;
}

export interface LeagueTable {
    readonly rows: readonly LeagueTableRow[];
    /** The matchday the table stands at: the most games a side played. */
    readonly round: number | null;
    /** The group shown when the table has several ("Group A"). */
    readonly group: string | null;
    /**
     * Every group, in the source's order, when the table has several (the
     * shown one among them). Absent for a single table, and from tables
     * stored before the groups were kept.
     */
    readonly groups?: readonly LeagueTableGroup[];
}

/** One group of a table in several: "Group A", "Eastern Conference". */
export interface LeagueTableGroup {
    readonly name: string | null;
    readonly rows: readonly LeagueTableRow[];
    readonly round: number | null;
}

/**
 * The zone a row's note names ("Champions League qualifying", "Relegation
 * playoff", "Qualifies for MLS Cup Playoffs - Wild Card Matches"): the
 * continental cups first, then the playoffs, then promotion or direct
 * qualification.
 */
export function zoneOf(
    description: string | null | undefined
): TableZone | null {
    const text = description ?? '';
    if (!text || /eliminat/i.test(text)) {
        return null;
    }
    if (/relegat|descenso/i.test(text)) {
        return 'relegation';
    }
    if (/champions league/i.test(text)) {
        return 'champions';
    }
    if (/europa league|conference|sudamericana/i.test(text)) {
        return 'europe';
    }
    if (
        /wild card|knockout|play-?\s?offs?\b/i.test(text) &&
        !/round one/i.test(text)
    ) {
        return 'playoff';
    }
    return /promotion|qualif|round of|round one|libertadores|ascenso/i.test(
        text
    )
        ? 'promotion'
        : null;
}

/**
 * The groups' tables as one: the group holding a followed team (else the
 * first) shown, with every group when there are several.
 */
function grouped(
    groups: readonly LeagueTableGroup[],
    preferred: (team: string) => boolean
): LeagueTable | null {
    const shown =
        groups.find((group) => group.rows.some((row) => preferred(row.team))) ??
        groups[0];
    if (!shown) {
        return null;
    }
    const { rows, round } = shown;
    return groups.length > 1
        ? { rows, round, group: shown.name, groups }
        : { rows, round, group: null };
}

function group(rows: LeagueTableRow[], name: string | null): LeagueTableGroup {
    const sorted = rows.sort((a, b) => a.rank - b.rank);
    const played = sorted.reduce((most, row) => Math.max(most, row.played), 0);
    return { name, rows: sorted, round: played > 0 ? played : null };
}

// ─── ESPN ──────────────────────────────────────────────────────────────

interface EspnEntry {
    readonly team?: {
        readonly displayName?: string;
        readonly logos?: readonly { readonly href?: string }[];
    };
    readonly note?: { readonly description?: string } | null;
    readonly stats?: readonly {
        readonly name?: string;
        readonly value?: number;
    }[];
}

interface EspnStandings {
    readonly name?: string;
    readonly standings?: { readonly entries?: readonly EspnEntry[] };
    readonly children?: readonly EspnStandings[];
}

/** ESPN's 500px logo, asked for at the table's size. */
export function espnBadge(href: string | undefined): string | null {
    const path = href?.match(/^https:\/\/a\.espncdn\.com(\/i\/.+)$/)?.[1];
    return path
        ? `https://a.espncdn.com/combiner/i?img=${path}&w=48&h=48`
        : (href ?? null);
}

export function parseEspnTable(
    body: unknown,
    preferred: (team: string) => boolean = () => false
): LeagueTable | null {
    const root = body as EspnStandings | null;
    const groups = (root?.children?.length ? root.children : root ? [root] : [])
        .map((child) => {
            const entries = (child.standings?.entries ?? []).filter(
                (entry) => !!entry.team?.displayName
            );
            return group(entries.map(espnRow), child.name ?? null);
        })
        .filter((entry) => entry.rows.length > 0);
    return grouped(groups, preferred);
}

function espnRow(entry: EspnEntry, index: number): LeagueTableRow {
    const stat = (name: string) =>
        entry.stats?.find((item) => item.name === name)?.value;
    return {
        rank: stat('rank') || index + 1,
        team: (entry.team?.displayName ?? '').trim(),
        badge: espnBadge(entry.team?.logos?.[0]?.href),
        played: stat('gamesPlayed') ?? 0,
        points: stat('points') ?? 0,
        form: [],
        zone: zoneOf(entry.note?.description),
    };
}

// ─── TheSportsDB ───────────────────────────────────────────────────────

interface SportsDbRow {
    readonly intRank?: string | number;
    readonly strTeam?: string;
    readonly strBadge?: string | null;
    readonly intPlayed?: string | number;
    readonly intPoints?: string | number;
    readonly strForm?: string | null;
    readonly strDescription?: string | null;
    readonly strGroup?: string | null;
}

export function parseLeagueTable(
    body: unknown,
    preferred: (team: string) => boolean = () => false
): LeagueTable | null {
    const list = (body as { table?: SportsDbRow[] | null } | null)?.table;
    const rows = Array.isArray(list)
        ? list.filter((row) => !!row?.strTeam)
        : [];
    const names = [...new Set(rows.map((row) => row.strGroup ?? ''))];
    const groups = names.map((name) =>
        group(
            rows
                .filter((row) => (row.strGroup ?? '') === name)
                .map(sportsDbRow),
            name
        )
    );
    return grouped(groups, preferred);
}

function sportsDbRow(row: SportsDbRow): LeagueTableRow {
    const form = (row.strForm ?? '')
        .toUpperCase()
        .split('')
        .filter((result): result is FormResult => /^[WDL]$/.test(result))
        .slice(-5);
    return {
        rank: Number(row.intRank) || 0,
        team: (row.strTeam ?? '').trim(),
        badge: row.strBadge || null,
        played: Number(row.intPlayed) || 0,
        points: Number(row.intPoints) || 0,
        form,
        zone: zoneOf(row.strDescription),
    };
}
