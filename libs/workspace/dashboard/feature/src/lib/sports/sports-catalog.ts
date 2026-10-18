import { isSpanishOrEnglishCategory } from '@iptvnator/shared/interfaces';
import { isMatchOver } from './match-clock';
import {
    isIdleEventChannel,
    isStaleSlot,
    parseSportEvent,
    type SportEvent,
} from './sport-events';
import {
    channelInSection,
    sectionForCompetition,
    SPORT_SECTIONS,
    type SportSectionId,
} from './sport-sections';

/**
 * TiagoTV sports: the active source's live channels sorted into the Home's
 * sections, from a fresh catalog (event channels rename themselves after
 * their match, so a cached catalog names yesterday's games).
 */
export interface SportsCatalogCategory {
    readonly category_id: string | number;
    readonly category_name: string;
}

export interface SportsCatalogStream {
    readonly stream_id: number | string;
    readonly name: string;
    readonly stream_icon?: string | null;
    readonly category_id: string | number | null;
}

export interface SportChannel {
    readonly streamId: number;
    readonly categoryId: string;
    /** The provider's name without its country and quality tags. */
    readonly title: string;
    readonly icon: string | null;
}

export interface SportMatch extends SportChannel {
    readonly event: SportEvent;
    readonly sectionId: SportSectionId;
}

export interface SportSectionContent {
    readonly matches: readonly SportMatch[];
    readonly channels: readonly SportChannel[];
}

export type SportsCatalog = Record<SportSectionId, SportSectionContent>;

/** "|ES| DAZN LIGA 1 HD B" → "DAZN LIGA 1 B", "ES: LALIGA+ PPV 3" → "LALIGA+ PPV 3". */
/** Sections whose events have no two sides (a race, a tennis session). */
const INDIVIDUAL_SPORTS = new Set<SportSectionId>(['tennis', 'motor']);

export function cleanChannelTitle(name: string): string {
    return name
        .replace(/^\s*(\|[A-Za-z-]{2,6}\|\s*|[A-Z]{2,3}\s*[:|-]\s*)/, '')
        .replace(/^(ES|UK|US)\s+/, '')
        .replace(/[ᵁᴴᴰˢ]+/g, ' ')
        .replace(/\b(UHD|FHD|HD|SD|4K|HEVC|SAT)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildSportsCatalog(
    categories: readonly SportsCatalogCategory[],
    streams: readonly SportsCatalogStream[],
    now = new Date()
): SportsCatalog {
    const kept = new Map<string, string>();
    for (const category of categories) {
        if (isSpanishOrEnglishCategory(category.category_name, 'live')) {
            kept.set(String(category.category_id), category.category_name);
        }
    }

    const matches = new Map<SportSectionId, Map<string, SportMatch>>();
    const channels = new Map<SportSectionId, Map<string, SportChannel>>();
    for (const section of SPORT_SECTIONS) {
        matches.set(section.id, new Map());
        channels.set(section.id, new Map());
    }

    for (const stream of streams) {
        const categoryId = String(stream.category_id ?? '');
        const categoryName = kept.get(categoryId);
        const streamId = Number(stream.stream_id);
        if (categoryName === undefined || !Number.isFinite(streamId)) {
            continue;
        }
        const channel: SportChannel = {
            streamId,
            categoryId,
            title: cleanChannelTitle(stream.name),
            icon: stream.stream_icon || null,
        };

        const event = parseSportEvent(stream.name);
        if (event) {
            const section =
                event.status === 'end'
                    ? null
                    : sectionForCompetition(event.competition, event.title);
            // Football sections show matches; their studio shows ("El Post
            // · Jornada 9") have no two sides.
            if (section && !INDIVIDUAL_SPORTS.has(section.id) && !event.home) {
                continue;
            }
            const key = `${event.title}|${event.competition}`.toLowerCase();
            const sectionMatches = section ? matches.get(section.id) : null;
            // The same match airs on the ES and GB feeds: one card each.
            if (sectionMatches && !sectionMatches.has(key)) {
                sectionMatches.set(key, {
                    ...channel,
                    title: event.title,
                    event,
                    sectionId: section!.id,
                });
            }
            continue;
        }
        if (
            isIdleEventChannel(stream.name) ||
            isStaleSlot(channel.title, now)
        ) {
            continue;
        }
        // "Resto del mundo" takes the football channels no card claims.
        const claimed = SPORT_SECTIONS.filter(
            (section) =>
                !section.catchAll &&
                channelInSection(section, stream.name, categoryName)
        );
        const owners = claimed.length
            ? claimed
            : SPORT_SECTIONS.filter(
                  (section) =>
                      section.catchAll &&
                      channelInSection(section, stream.name, categoryName)
              );
        for (const section of owners) {
            keepChannel(channels.get(section.id)!, channel);
        }
    }

    const catalog = {} as Record<SportSectionId, SportSectionContent>;
    for (const section of SPORT_SECTIONS) {
        catalog[section.id] = {
            matches: [...matches.get(section.id)!.values()].sort(byKickOff),
            channels: [...channels.get(section.id)!.values()],
        };
    }
    return catalog;
}

/**
 * HD and SD copies of one channel share a cleaned title: the first one
 * stays, unless a later one has the logo it lacks.
 */
function keepChannel(
    sectionChannels: Map<string, SportChannel>,
    channel: SportChannel
): void {
    const key = channel.title.toLowerCase();
    const kept = sectionChannels.get(key);
    if (!kept || (!kept.icon && channel.icon)) {
        sectionChannels.set(key, channel);
    }
}

/**
 * The Home's "today" row: matches on now, then today's (local) upcoming
 * kick-offs, across every section but "Resto del mundo"; none that is over
 * (see match-clock).
 */
export function todaysMatches(
    catalog: SportsCatalog,
    now = new Date(),
    kickOffOf: (match: SportMatch) => Date | null = () => null
): SportMatch[] {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const matches: SportMatch[] = [];
    for (const section of SPORT_SECTIONS) {
        // "Resto del mundo" keeps its many matches (Burundi's league,
        // Malawi's…) on its own page.
        if (section.catchAll) {
            continue;
        }
        for (const match of catalog[section.id]?.matches ?? []) {
            const start = match.event.start;
            if (isMatchOver(match, kickOffOf(match), now)) {
                continue;
            }
            if (
                match.event.status === 'live' ||
                (start !== null && start <= endOfDay)
            ) {
                matches.push(match);
            }
        }
    }
    return matches.sort(byKickOff);
}

function byKickOff(a: SportMatch, b: SportMatch): number {
    if (a.event.status !== b.event.status) {
        return a.event.status === 'live' ? -1 : 1;
    }
    return (a.event.start?.getTime() ?? 0) - (b.event.start?.getTime() ?? 0);
}
