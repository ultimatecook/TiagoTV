import { isSpanishOrEnglishCategory } from '@iptvnator/shared/interfaces';
import { rankedChannels, type MatchChannel } from './match-channels';
import { isMatchOn, isMatchOver, startOf } from './match-clock';
import {
    feedQuality,
    type FeedQuality,
    type MatchFeed,
    type NamedChannel,
} from './match-feeds';
import { buildMatches, type EventSlot } from './match-fixtures';
import {
    isIdleEventChannel,
    isStaleSlot,
    parseNamedMatch,
    parseSportEvent,
    type SportEvent,
} from './sport-events';
import {
    channelInSection,
    sectionForCompetition,
    SPORT_SECTIONS,
    type SportSectionId,
} from './sport-sections';
import { teamKey } from './team-names';

/**
 * TiagoTV sports: the active source's live channels sorted into the Home's
 * sections, from a fresh catalog (event channels rename themselves after
 * their match, so a cached catalog names yesterday's games). Channels come
 * from the kept (Spanish and English) categories only; matches are read
 * from every language's event channels (see match-fixtures), and each
 * lists every signal that carries it, in any language (see match-feeds).
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
    /** When the panel last named it (epoch seconds): an event slot's "Live" since. */
    readonly added?: string | number | null;
}

export interface SportChannel {
    readonly streamId: number;
    readonly categoryId: string;
    /** The provider's name without its country and quality tags. */
    readonly title: string;
    readonly icon: string | null;
}

/**
 * One match, from all the event channels that name it. Its channel fields
 * are the kept feed that plays it, or, without one, its first `via`.
 */
export interface SportMatch extends SportChannel {
    /** The match: its section and both sides, however a feed spells them. */
    readonly key: string;
    /** Every key its feeds' spellings give, `key` first. */
    readonly keys: readonly string[];
    readonly event: SportEvent;
    readonly sectionId: SportSectionId;
    /**
     * When the first feed calling it "Live" was so named (the panel's
     * `added`): a "Live" the provider never renamed is as old as that.
     */
    readonly liveSince?: Date | null;
    /**
     * No kept feed names it: the competition's channels that may show it
     * ("M+ LaLiga TV", "DAZN LaLiga"). Empty when it has a feed of its own.
     */
    readonly via: readonly MatchChannel[];
    /**
     * The channel it plays on, as a viewer knows it: its feed's category
     * ("Premier League PPV", "DAZN"), else its first `via`'s name.
     */
    readonly channelName?: string | null;
    /**
     * Every signal that carries it, in any language, the owner's order
     * first (see match-feeds): its event slots, the channels that name
     * it, and its `via`. The match's own channel fields stay the default.
     */
    readonly feeds?: readonly MatchFeed[];
}

export interface SportSectionContent {
    readonly matches: readonly SportMatch[];
    readonly channels: readonly SportChannel[];
}

export type SportsCatalog = Record<SportSectionId, SportSectionContent>;

/** Sections whose events have no two sides (a race, a tennis session). */
const INDIVIDUAL_SPORTS = new Set<SportSectionId>(['tennis', 'motor']);

/** A cheap look for a match in a channel's name ("A vs B", "A v B"). */
const VERSUS_HINT = /\sv(s\.?)?\s/i;
/** Recordings and time-shifted copies show a match that is over. */
const REPLAY = /\b(repl(a)?y|delay|timeshift)\b|\+1\b/i;

/** "|ES| DAZN LIGA 1 HD B" → "DAZN LIGA 1 B", "ES: LALIGA+ PPV 3" → "LALIGA+ PPV 3". */
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
    const names = new Map<string, string>();
    const kept = new Set<string>();
    for (const category of categories) {
        const id = String(category.category_id);
        names.set(id, category.category_name);
        if (isSpanishOrEnglishCategory(category.category_name, 'live')) {
            kept.add(id);
        }
    }

    const slots = new Map<SportSectionId, EventSlot[]>();
    const named: NamedChannel[] = [];
    const channels = new Map<SportSectionId, Map<string, SportChannel>>();
    // Every copy of the sections' channels, for the matches' signals.
    const copies = new Map<SportSectionId, SportChannel[]>();
    const qualities = new Map<number, FeedQuality>();
    for (const section of SPORT_SECTIONS) {
        slots.set(section.id, []);
        channels.set(section.id, new Map());
        copies.set(section.id, []);
    }

    for (const stream of streams) {
        const categoryId = String(stream.category_id ?? '');
        const categoryName = names.get(categoryId);
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
            const slot = {
                channel,
                event,
                kept: kept.has(categoryId),
                categoryName,
                namedAt: namedAt(stream.added),
                quality: feedQuality(stream.name),
            };
            const sectionId = slotSection(slot);
            if (sectionId) {
                slots.get(sectionId)!.push(slot);
            }
            continue;
        }
        const pair = VERSUS_HINT.test(stream.name)
            ? namedChannel(channel, stream.name, categoryName, now)
            : null;
        if (pair) {
            named.push(pair);
        }
        if (
            !kept.has(categoryId) ||
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
            copies.get(section.id)?.push(channel);
        }
        const quality = owners.length ? feedQuality(stream.name) : null;
        if (quality) {
            qualities.set(streamId, quality);
        }
    }

    const catalog = {} as Record<SportSectionId, SportSectionContent>;
    for (const section of SPORT_SECTIONS) {
        // In the order the page lists them, for TiagoTV liviano's row too.
        const sectionChannels = rankedChannels([
            ...channels.get(section.id)!.values(),
        ]);
        catalog[section.id] = {
            matches: buildMatches(
                section,
                slots.get(section.id)!,
                sectionChannels,
                now,
                {
                    named,
                    categoryNames: names,
                    copies: copies.get(section.id),
                    qualities,
                }
            ).sort(byKickOff),
            channels: sectionChannels,
        };
    }
    return catalog;
}

/**
 * The section of an event channel's match, if it shows on one: football
 * sections show matches, not their studio shows ("El Post · Jornada 9");
 * another language's feed counts only for a match with two sides.
 */
function slotSection(slot: EventSlot): SportSectionId | null {
    const { event } = slot;
    const section = sectionForCompetition(event.competition, event.title);
    const individual = section !== null && INDIVIDUAL_SPORTS.has(section.id);
    if (
        !section ||
        (!individual && !event.home) ||
        (!slot.kept && (individual || !event.home || !event.away))
    ) {
        return null;
    }
    return section.id;
}

/**
 * A channel that names a match without being its event slot ("UEFA | 13
 * - Aston Villa vs Ajax"), in any language, but no replay's.
 */
function namedChannel(
    channel: SportChannel,
    name: string,
    categoryName: string,
    now: Date
): NamedChannel | null {
    const match = REPLAY.test(categoryName)
        ? null
        : parseNamedMatch(channel.title, now);
    return match
        ? {
              channel,
              categoryName,
              home: teamKey(match.home),
              away: teamKey(match.away),
              number: match.number,
              quality: feedQuality(name),
          }
        : null;
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

/** The competitions the "today" row puts first, by tier. */
const TIERS: Partial<Record<SportSectionId, number>> = {
    'champions-league': 0,
    laliga: 0,
    'premier-league': 0,
    'liga-argentina': 0,
    libertadores: 0,
    'serie-a': 1,
    bundesliga: 1,
    'ligue-1': 1,
    'europa-league': 1,
};
const tierOf = (match: SportMatch) => TIERS[match.sectionId] ?? 2;

/**
 * The Home's "today" row: the matches on now, the big competitions first,
 * then today's (local) kick-offs in order, across every section but
 * "Resto del mundo"; none that is over (see match-clock) and none from an
 * earlier day.
 */
export function todaysMatches(
    catalog: SportsCatalog,
    now = new Date(),
    kickOffOf: (match: SportMatch) => Date | null = () => null
): SportMatch[] {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
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
            const kickOff = startOf(match, kickOffOf(match));
            if (isMatchOver(match, kickOff, now)) {
                continue;
            }
            if (
                isMatchOn(match, kickOff, now) ||
                (kickOff !== null &&
                    kickOff >= startOfDay &&
                    kickOff <= endOfDay)
            ) {
                matches.push(match);
            }
        }
    }
    return orderMatches(matches, now, kickOffOf);
}

/**
 * The matches on now first (the big competitions' before the others'),
 * then the rest by kick-off.
 */
export function orderMatches(
    matches: readonly SportMatch[],
    now = new Date(),
    kickOffOf: (match: SportMatch) => Date | null = () => null
): SportMatch[] {
    const kickOff = (match: SportMatch) =>
        startOf(match, kickOffOf(match))?.getTime() ?? 0;
    const on = new Map(
        matches.map((match) => [
            match,
            isMatchOn(match, startOf(match, kickOffOf(match)), now),
        ])
    );
    return [...matches].sort((a, b) => {
        const onA = on.get(a) ?? false;
        if (onA !== (on.get(b) ?? false)) {
            return onA ? -1 : 1;
        }
        return onA
            ? tierOf(a) - tierOf(b) || kickOff(a) - kickOff(b)
            : kickOff(a) - kickOff(b) || tierOf(a) - tierOf(b);
    });
}

function byKickOff(a: SportMatch, b: SportMatch): number {
    if (a.event.status !== b.event.status) {
        return a.event.status === 'live' ? -1 : 1;
    }
    return (a.event.start?.getTime() ?? 0) - (b.event.start?.getTime() ?? 0);
}

/** The panel's `added` (epoch seconds) in ms, or null. */
export function namedAt(added: string | number | null | undefined): number | null {
    const seconds = Number(added);
    return added !== null &&
        added !== '' &&
        Number.isFinite(seconds) &&
        seconds > 0
        ? seconds * 1000
        : null;
}
