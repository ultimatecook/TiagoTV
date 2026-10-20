import {
    buildSportsCatalog,
    followedTeamOf,
    isMatchOn,
    KickoffMemory,
    sectionsWithChannels,
    SPORT_SECTIONS,
    teamDisplayName,
    todaysMatches,
    type SportMatch,
    type SportsCatalog,
    type SportsCatalogStream,
    type SportSectionId,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { PREFETCH, SPORTS, type Priority } from '../core/request-queue';
import type { XtreamCategory, XtreamClient, XtreamLiveStream } from '../xtream/client';
import { compactStream } from './live';
import { isKeptLive, planForeign, planKept, type SportsNotes } from './sports-plan';

/**
 * "Deportes": today's matches and each competition's channels, read like
 * the desktop app reads them (buildSportsCatalog, todaysMatches) from the
 * provider's event channels ("Live | Real Madrid - Barcelona | LaLiga |
 * ES") and the competitions' own categories ("|ES| ✪ DAZN LA LIGA"), the
 * categories chosen by sports-plan.ts. The board shows as soon as the
 * event categories are in, and again once the rest are; kick-offs are
 * remembered across loads (KickoffMemory) as on the desktop.
 */
export interface SportsStats {
    readonly requested: number;
    readonly failed: number;
    /** Channel lists reused from earlier loads. */
    readonly stored: number;
    /** Other languages' categories read for their fixtures. */
    readonly foreign: number;
}

export interface SportsData {
    readonly catalog: SportsCatalog;
    /** Today's matches, the ones on now first (todaysMatches). */
    readonly today: readonly SportMatch[];
    readonly failed: number;
    readonly loadedAt: number;
    /** Every category is in (not only the event ones). */
    readonly complete: boolean;
    readonly stats: SportsStats;
}

let kickoffs: KickoffMemory | null = null;

function memory(): KickoffMemory {
    if (!kickoffs) {
        let storage: Storage | null = null;
        try {
            storage = window.localStorage;
        } catch {
            storage = null;
        }
        kickoffs = new KickoffMemory(storage);
    }
    return kickoffs;
}

function kickOffOf(match: SportMatch): Date | null {
    return match.event.start ?? memory().kickOffOf(match);
}

export function isLive(match: SportMatch, now = new Date()): boolean {
    return isMatchOn(match, kickOffOf(match), now);
}

/** The stream a match plays: its own feed, else its competition's channel. */
export function matchStreamId(match: SportMatch): number | null {
    if (Number.isFinite(match.streamId)) {
        return match.streamId;
    }
    const via = match.via[0];
    return via ? via.channel.streamId : null;
}

/** "DAZN LaLiga", "Premier League PPV": where a match plays. */
export function matchChannel(match: SportMatch): string {
    return match.channelName || (match.via[0] ? match.via[0].name : '') || match.title;
}

export function matchSides(match: SportMatch): { home: string | null; away: string | null } {
    const { home, away } = match.event;
    return home && away
        ? { home: teamDisplayName(home), away: teamDisplayName(away) }
        : { home: null, away: null };
}

export function involvesMyTeam(match: SportMatch): boolean {
    return followedTeamOf(match.event.home) !== null || followedTeamOf(match.event.away) !== null;
}

/** Matches on now per competition: the league cards' "en vivo" pills. */
export function liveCounts(data: SportsData, now = new Date()): Map<SportSectionId, number> {
    const counts = new Map<SportSectionId, number>();
    for (const section of SPORT_SECTIONS) {
        const live = (data.catalog[section.id]?.matches ?? []).filter((match) => isLive(match, now)).length;
        if (live > 0) {
            counts.set(section.id, live);
        }
    }
    return counts;
}

/** Channels across the competitions (a channel in two counts twice). */
export function channelCount(data: SportsData): number {
    return SPORT_SECTIONS.reduce((count, section) => count + (data.catalog[section.id]?.channels.length ?? 0), 0);
}

export function buildSportsData(
    categories: readonly XtreamCategory[],
    streams: readonly SportsCatalogStream[],
    complete: boolean,
    stats: SportsStats,
    now = new Date()
): SportsData {
    const catalog = buildSportsCatalog(categories, streams, now);
    const all: SportMatch[] = [];
    for (const section of SPORT_SECTIONS) {
        const content = catalog[section.id];
        if (content) {
            all.push(...content.matches);
        }
    }
    memory().remember(all, now.getTime());
    return {
        catalog,
        today: todaysMatches(catalog, now, kickOffOf).filter((match) => matchStreamId(match) !== null),
        failed: stats.failed,
        loadedAt: Date.now(),
        complete,
        stats,
    };
}

export interface SportsLoadOptions {
    readonly notes: SportsNotes;
    readonly priority?: Priority;
    /** The board with the event categories in, before the rest. */
    readonly onPartial?: (data: SportsData) => void;
    /** Other languages' event categories looked through after the load. */
    readonly onDiscovered?: (data: SportsData) => void;
    /** The clock (tools/sports-snapshot-check.mjs replays a snapshot's day). */
    readonly now?: () => number;
}

export async function loadSports(
    client: XtreamClient,
    categories: readonly XtreamCategory[],
    options: SportsLoadOptions
): Promise<SportsData> {
    const { notes } = options;
    const priority = options.priority ?? SPORTS;
    const clock = options.now ?? Date.now;
    const build = (complete: boolean, stats: SportsStats) => buildSportsData(categories, streams(), complete, stats, new Date(clock()));
    const kept = new Set(categories.filter(isKeptLive).map((category) => String(category.category_id)));
    const fresh = new Map<string, SportsCatalogStream[]>();
    let requested = 0;
    let failed = 0;
    let firstError: unknown = null;
    // All of a phase is queued at once: no catalog request slips between.
    const fetchAll = (ids: readonly string[], at: Priority) =>
        Promise.all(
            ids.map((id) => {
                requested++;
                return client.streams<XtreamLiveStream>('live', id, at).then(
                    (list) => {
                        const streams = list.map(compactStream);
                        fresh.set(id, streams);
                        notes.record(id, streams, kept.has(id), clock());
                    },
                    (error) => {
                        failed++;
                        firstError = firstError || error;
                    }
                );
            })
        );
    const plan = planKept(categories, notes, clock());
    const streams = () => {
        const all: SportsCatalogStream[] = [];
        plan.stored.forEach((list, id) => {
            if (!fresh.has(id)) {
                all.push(...list);
            }
        });
        fresh.forEach((list) => all.push(...list));
        return all;
    };
    const stats = (foreign: number): SportsStats => ({ requested, failed, stored: plan.stored.size, foreign });

    await fetchAll(plan.events, priority);
    if (fresh.size === 0 && plan.stored.size === 0 && plan.others.length === 0 && failed > 0) {
        throw firstError || new Error('no sports categories');
    }
    options.onPartial?.(build(false, stats(0)));
    await fetchAll(plan.others, priority);
    const followed = sectionsWithChannels(build(false, stats(0)).catalog);
    const foreign = planForeign(categories, notes, followed, clock());
    await fetchAll(foreign.fixtures, priority);
    notes.save();
    if (fresh.size === 0 && plan.stored.size === 0) {
        throw firstError || new Error('no sports categories');
    }
    const data = build(true, stats(foreign.fixtures.length));
    if (foreign.discover.length > 0) {
        // Looked through in the background, behind the catalog.
        void fetchAll(foreign.discover, PREFETCH).then(() => {
            notes.save();
            const found = foreign.discover.some((id) => (notes.get(id)?.named ?? []).some((section) => followed.has(section)));
            if (found) {
                options.onDiscovered?.(build(true, stats(foreign.fixtures.length + foreign.discover.length)));
            }
        });
    }
    return data;
}
