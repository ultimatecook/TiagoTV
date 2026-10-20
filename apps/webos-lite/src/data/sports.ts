import { isSpanishOrEnglishCategory } from '@iptvnator/shared/interfaces';
import {
    buildSportsCatalog,
    followedTeamOf,
    isMatchOn,
    SPORT_SECTIONS,
    teamDisplayName,
    todaysMatches,
    type SportMatch,
    type SportsCatalog,
    type SportsCatalogStream,
    type SportSectionId,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { XtreamCategory, XtreamClient, XtreamLiveStream } from '../xtream/client';
import { compactStream } from './live';
import { mapSettled } from './pool';

/**
 * "Deportes": today's matches and each competition's channels, read like
 * the desktop app reads them (buildSportsCatalog, todaysMatches) from the
 * provider's event channels ("Live | Real Madrid - Barcelona | LaLiga |
 * ES") and the competitions' own categories ("|ES| ✪ DAZN LA LIGA"). The
 * TV loads only the kept categories that hold them, one at a time.
 */
const EVENT_CATEGORY = /\b(events?|eventos?|ppv)\b/i;
export const MAX_SPORTS_CATEGORIES = 30;

export function sportsCategoryIds(
    categories: readonly XtreamCategory[],
    max = MAX_SPORTS_CATEGORIES
): string[] {
    const events: string[] = [];
    const competitions: string[] = [];
    for (const category of categories) {
        const name = category.category_name;
        if (!isSpanishOrEnglishCategory(name, 'live')) {
            continue;
        }
        const id = String(category.category_id);
        if (EVENT_CATEGORY.test(name)) {
            events.push(id);
        } else if (
            SPORT_SECTIONS.some((section) => !!section.category && section.category.test(name))
        ) {
            competitions.push(id);
        }
    }
    return events.concat(competitions).slice(0, max);
}

export interface SportsData {
    readonly catalog: SportsCatalog;
    /** Today's matches, the ones on now first (todaysMatches). */
    readonly today: readonly SportMatch[];
    readonly failed: number;
    readonly loadedAt: number;
}

export function isLive(match: SportMatch, now = new Date()): boolean {
    return isMatchOn(match, null, now);
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

export async function loadSports(
    client: XtreamClient,
    categories: readonly XtreamCategory[],
    onProgress?: (done: number, total: number) => void,
    background = false
): Promise<SportsData> {
    const ids = sportsCategoryIds(categories);
    const settled = await mapSettled(
        ids,
        1,
        (id) => client.streams<XtreamLiveStream>('live', id, background),
        onProgress
    );
    const streams: SportsCatalogStream[] = [];
    let failed = 0;
    for (const result of settled) {
        if (!result.ok) {
            failed++;
            continue;
        }
        for (const stream of result.value) {
            streams.push(compactStream(stream));
        }
    }
    if (failed > 0 && failed === settled.length) {
        const first = settled[0];
        throw first.ok ? new Error('failed') : first.error;
    }
    const now = new Date();
    const catalog = buildSportsCatalog(categories, streams, now);
    return {
        catalog,
        today: todaysMatches(catalog, now).filter((match) => matchStreamId(match) !== null),
        failed,
        loadedAt: Date.now(),
    };
}
