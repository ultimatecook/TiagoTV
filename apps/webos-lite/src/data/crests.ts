import {
    followedTeamOf,
    isSameTeam,
    SportsApiClient,
    teamKey,
    TeamCrestResolver,
    type LeagueTableRow,
    type SportSectionId,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { getJson, RequestError } from '../core/http';
import { hasTable, leagueTable } from './league-table';

/**
 * Team crests for "Tus equipos" and the match cards, the desktop's where
 * the TV can reach them:
 *
 *   1. ESPN's league tables (the ones the league pages already show): the
 *      team's row in its competition's table, or in its own league's for a
 *      followed team in a cup. ESPN's hosts (site.api.espn.com,
 *      a.espncdn.com) chain to long-trusted roots that a 2019 TV knows.
 *   2. TheSportsDB, as the desktop looks crests up (TeamCrestResolver).
 *      Its host is behind Cloudflare, whose certificates can chain to
 *      Let's Encrypt's ISRG Root X1, which webOS 4's store may lack: a
 *      failure there turns it off for a while, quietly.
 *
 * Without one the card keeps the team's initials. Answers are kept across
 * launches; failures (as opposed to "no crest") are not.
 */
const KEY = 'tiagotv-lite:crests:v1';
const HIT_MS = 30 * 24 * 3600 * 1000;
const MISS_MS = 2 * 24 * 3600 * 1000;
const DOWN_MS = 30 * 60 * 1000;
/** ESPN's logos at the size a crest is drawn (the tables ask 48 px). */
const ESPN_SIZE = /([?&])w=\d+&h=\d+/;

interface Entry {
    readonly u: string | null;
    readonly at: number;
}

export interface CrestStats {
    espn: number;
    sportsDb: number;
    misses: number;
    failures: number;
    sportsDbDown: boolean;
}

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function rowsOf(table: { rows: readonly LeagueTableRow[]; groups?: readonly { rows: readonly LeagueTableRow[] }[] }): LeagueTableRow[] {
    const rows: LeagueTableRow[] = [];
    for (const group of table.groups ?? [table]) {
        rows.push(...group.rows);
    }
    return rows;
}

export class CrestBook {
    private readonly book: Record<string, Entry>;
    private readonly pending = new Map<string, Promise<string | null>>();
    private downUntil = 0;
    private failedNow = 0;
    private readonly sportsDb: TeamCrestResolver;
    readonly stats: CrestStats = { espn: 0, sportsDb: 0, misses: 0, failures: 0, sportsDbDown: false };

    constructor(
        private readonly store: Storage | null = storage(),
        private readonly now: () => number = Date.now
    ) {
        let parsed: unknown = null;
        try {
            const raw = store ? store.getItem(KEY) : null;
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        this.book = parsed && typeof parsed === 'object' ? (parsed as Record<string, Entry>) : {};
        const fetchJson = (url: string) => this.fetchSportsDb(url);
        this.sportsDb = new TeamCrestResolver({
            fetchJson,
            storage: null,
            client: new SportsApiClient({ fetchJson }, { gapMs: 3000, retryMs: 4000 }),
        });
    }

    private key(team: string, section: SportSectionId | null): string {
        return `${section ?? '-'}:${teamKey(team)}`;
    }

    /** The crest if known: a URL, null for "none", undefined when not asked yet. */
    known(team: string, section: SportSectionId | null): string | null | undefined {
        const entry = this.book[this.key(team, section)];
        if (!entry || this.now() - entry.at > (entry.u ? HIT_MS : MISS_MS)) {
            return undefined;
        }
        return entry.u;
    }

    resolve(team: string, section: SportSectionId | null): Promise<string | null> {
        const known = this.known(team, section);
        if (known !== undefined) {
            return Promise.resolve(known);
        }
        const key = this.key(team, section);
        let request = this.pending.get(key);
        if (!request) {
            const failuresBefore = this.failedNow;
            request = this.lookup(team, section).then(
                (url) => {
                    this.pending.delete(key);
                    // A miss while a source failed may be no miss: not kept.
                    if (url || this.failedNow === failuresBefore) {
                        this.book[key] = { u: url, at: this.now() };
                        this.save();
                    }
                    if (!url) {
                        this.stats.misses++;
                    }
                    return url;
                },
                () => {
                    this.pending.delete(key);
                    this.stats.failures++;
                    return null;
                }
            );
            this.pending.set(key, request);
        }
        return request;
    }

    private async lookup(team: string, section: SportSectionId | null): Promise<string | null> {
        const own = followedTeamOf(team);
        const sections: SportSectionId[] = [];
        for (const candidate of [section, own ? own.sectionId : null]) {
            if (candidate && hasTable(candidate) && sections.indexOf(candidate) < 0) {
                sections.push(candidate);
            }
        }
        const wanted = teamKey(team);
        for (const candidate of sections) {
            const table = await leagueTable(candidate);
            if (!table) {
                this.failedNow++;
                continue;
            }
            const row = rowsOf(table).find((entry) => isSameTeam(teamKey(entry.team), wanted));
            if (row && row.badge) {
                this.stats.espn++;
                return row.badge.replace(ESPN_SIZE, '$1w=128&h=128');
            }
        }
        if (this.now() < this.downUntil) {
            return null;
        }
        const url = await this.sportsDb.resolve(team, section);
        if (url) {
            this.stats.sportsDb++;
        }
        return url;
    }

    /** TheSportsDB through the TV's XHR; an unreachable host is left alone. */
    private fetchSportsDb(url: string): Promise<unknown> {
        if (this.now() < this.downUntil) {
            return Promise.reject(new RequestError('network'));
        }
        return getJson(url, 10000).then(
            (body) => body,
            (error) => {
                if (error instanceof RequestError && error.kind === 'parse') {
                    return null;
                }
                this.failedNow++;
                if (error instanceof RequestError && error.kind !== 'http') {
                    this.downUntil = this.now() + DOWN_MS;
                    this.stats.sportsDbDown = true;
                }
                throw error;
            }
        );
    }

    private save(): void {
        try {
            this.store?.setItem(KEY, JSON.stringify(this.book));
        } catch {
            // A full storage only costs repeat lookups.
        }
    }
}

let shared: CrestBook | null = null;

/** The app's one crest book. */
export function crestBook(): CrestBook {
    if (!shared) {
        shared = new CrestBook();
    }
    return shared;
}
