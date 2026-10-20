import { categoryLanguageCode } from '@iptvnator/shared/interfaces';
import {
    channelCopies,
    competitionChannels,
    SINGLE_COMPETITION_SECTIONS,
    type MatchChannel,
} from './match-channels';
import {
    categoryChannelName,
    matchFeeds,
    type FeedContext,
    type FeedQuality,
    type NamedChannel,
} from './match-feeds';
import { parseSportEvent, type SportEvent } from './sport-events';
import {
    namesOtherSport,
    sectionForCompetition,
    type SportSection,
    type SportSectionId,
} from './sport-sections';
import type { SportChannel, SportMatch } from './sports-catalog';
import { isSameTeam, teamDisplayName, teamKey } from './team-names';

export { categoryChannelName } from './match-feeds';

/**
 * TiagoTV sports: one match, many event slots — on the Spanish and English
 * feeds the viewer keeps, and on other languages' feeds ("FR| ✪ DAZN
 * LALIGA ES" names Real Madrid - Sevilla when no Spanish feed does). The
 * slots of one match make one card: a kept feed plays it; without one,
 * the competition's channels are offered ("M+ LaLiga TV", "DAZN LaLiga").
 * Another language's feed never plays by default, but the match's page
 * lists it among its signals (`SportMatch.feeds`, see match-feeds).
 */
export interface EventSlot {
    readonly channel: SportChannel;
    readonly event: SportEvent;
    /** On a feed the viewer keeps, so it may play. */
    readonly kept: boolean;
    /** Its category's name ("|ES| ✪ LALIGA PPV"), for which feed plays. */
    readonly categoryName: string;
    /** When the panel named the slot (ms), if it says. */
    readonly namedAt?: number | null;
    /** Its quality, where its name says ("ᴴᴰ", "SD"). */
    readonly quality?: FeedQuality | null;
}

/** What the matches' signals are read from besides their slots. */
export interface MatchSources {
    /** The channels that name a match without being event slots. */
    readonly named?: readonly NamedChannel[];
    /** Every category's name, by id: a `via` channel's language. */
    readonly categoryNames?: ReadonlyMap<string, string>;
    /** The section's channels with their HD and SD copies. */
    readonly copies?: readonly SportChannel[];
    /** The qualities their names give, by stream id. */
    readonly qualities?: ReadonlyMap<number, FeedQuality>;
}

interface Fixture {
    readonly slots: EventSlot[];
    readonly keys: Set<string>;
    /** Both sides' keys; null for a race or a tennis session. */
    readonly teams: readonly [string, string] | null;
    ended: boolean;
}

/** Studio shows named after a match are not the match. */
const SHOW =
    /\b((avant|apr[eè]s|pre|post)[- ]?match|previa|resumen|highlights|r[ée]sum[ée]|replay|classiques?)\b/i;
/** One match's kick-offs on two feeds lie closer than this. */
const SAME_MATCH_MS = 4 * 3600_000;

const plain = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

/** A slot's key: its section and both sides, or its title and competition. */
export function slotKey(sectionId: SportSectionId, event: SportEvent): string {
    return event.home && event.away
        ? `${sectionId}|${teamKey(event.home)}|${teamKey(event.away)}`
        : `${sectionId}|${plain(event.title)}|${plain(event.competition)}`;
}

/**
 * The kick-offs that event channels announce ("Next | 2026-10-18 | 19:00
 * (GMT) | …"), by match key: facts, however old the list naming them (the
 * stored catalog's, for a match first seen once it was on). Two feeds'
 * times for one match: the later (one can be its studio show's).
 */
export function announcedKickOffs(
    streams: readonly { readonly name: string }[]
): Map<string, number> {
    const kickOffs = new Map<string, number>();
    for (const stream of streams) {
        const event = parseSportEvent(stream.name);
        const start = event?.status === 'next' ? event.start?.getTime() : null;
        const section =
            event && start
                ? sectionForCompetition(event.competition, event.title)
                : null;
        if (event && start && section) {
            const key = slotKey(section.id, event);
            kickOffs.set(key, Math.max(start, kickOffs.get(key) ?? 0));
        }
    }
    return kickOffs;
}

/**
 * The section's matches from its slots: one per match, never one that a
 * feed already calls over ("End | …"), and none that no kept channel can
 * show.
 */
export function buildMatches(
    section: SportSection,
    slots: readonly EventSlot[],
    channels: readonly SportChannel[],
    now: Date,
    sources: MatchSources = {}
): SportMatch[] {
    let offered: MatchChannel[] | null = null;
    const offers = () =>
        (offered ??= SINGLE_COMPETITION_SECTIONS.has(section.id)
            ? competitionChannels(channels)
            : []);
    let copies: Map<number, readonly SportChannel[]> | null = null;
    const context: FeedContext = {
        named: sources.named ?? [],
        categoryNames: sources.categoryNames ?? new Map(),
        copiesOf: (option) =>
            (copies ??= channelCopies(sources.copies ?? channels)).get(
                option.channel.streamId
            ) ?? [option.channel],
        qualityOf: (streamId) => sources.qualities?.get(streamId) ?? null,
    };
    const matches: SportMatch[] = [];
    for (const fixture of mergeSlots(section.id, slots, now)) {
        const match = fixture.ended
            ? null
            : toMatch(
                  section.id,
                  fixture,
                  fixture.slots.some(isKept) ? [] : offers(),
                  context
              );
        if (match) {
            matches.push(match);
        }
    }
    return matches;
}

function mergeSlots(
    sectionId: SportSectionId,
    slots: readonly EventSlot[],
    now: Date
): Fixture[] {
    const fixtures: Fixture[] = [];
    const finished: EventSlot[] = [];
    for (const slot of slots) {
        if (SHOW.test(slot.event.title)) {
            continue;
        }
        if (slot.event.status === 'end') {
            finished.push(slot);
            continue;
        }
        const key = slotKey(sectionId, slot.event);
        const fixture = fixtures.find((candidate) =>
            isSameFixture(candidate, slot, key)
        );
        if (fixture) {
            fixture.slots.push(slot);
            fixture.keys.add(key);
            continue;
        }
        const { home, away } = slot.event;
        fixtures.push({
            slots: [slot],
            keys: new Set([key]),
            teams: home && away ? [teamKey(home), teamKey(away)] : null,
            ended: false,
        });
    }
    // An "End" on any feed ends the match, unless it is one from an
    // earlier meeting of the sides (this one kicks off later).
    for (const slot of finished) {
        const key = slotKey(sectionId, slot.event);
        for (const fixture of fixtures) {
            const start = latestStart(fixture.slots);
            if (
                isSameFixture(fixture, slot, key) &&
                (start === null || start <= now.getTime())
            ) {
                fixture.ended = true;
            }
        }
    }
    return fixtures;
}

function isSameFixture(
    fixture: Fixture,
    slot: EventSlot,
    key: string
): boolean {
    const { home, away, start } = slot.event;
    if (!fixture.teams || !home || !away) {
        return fixture.keys.has(key);
    }
    const [a, b] = fixture.teams;
    const [h, w] = [teamKey(home), teamKey(away)];
    if (
        !(isSameTeam(a, h) && isSameTeam(b, w)) &&
        !(isSameTeam(a, w) && isSameTeam(b, h))
    ) {
        return false;
    }
    const known = latestStart(fixture.slots);
    return (
        start === null ||
        known === null ||
        Math.abs(start.getTime() - known) < SAME_MATCH_MS
    );
}

function toMatch(
    sectionId: SportSectionId,
    fixture: Fixture,
    offers: readonly MatchChannel[],
    context: FeedContext
): SportMatch | null {
    // A feed filed under another sport's category plays last (see below).
    const own = fixture.slots
        .filter(isKept)
        .sort(
            (a, b) =>
                byRegion(a, b) ||
                Number(misfiled(sectionId, a)) - Number(misfiled(sectionId, b))
        );
    // The kept feed's names; else, of the other languages', a dated one's.
    const shown =
        own[0] ??
        fixture.slots.find((slot) => slot.event.start) ??
        fixture.slots[0];
    const playing = own[0]?.channel ?? offers[0]?.channel;
    const start = latestStart(own) ?? latestStart(fixture.slots) ?? null;
    const live = fixture.slots.some((slot) => slot.event.status === 'live');
    const liveSince = earliestLiveName(fixture.slots);
    // A fixture only another language names, with no time to show it by.
    if (!playing || (!own.length && !live && start === null)) {
        return null;
    }
    const name = (team: string | null) =>
        team && !own.length ? teamDisplayName(team) : team;
    const home = name(shown.event.home);
    const away = name(shown.event.away);
    const title = home && away ? `${home} - ${away}` : shown.event.title;
    const key = slotKey(sectionId, shown.event);
    return {
        ...playing,
        title,
        key,
        keys: [key, ...[...fixture.keys].filter((other) => other !== key)],
        event: {
            ...shown.event,
            status: live ? 'live' : 'next',
            title,
            home,
            away,
            start: start === null ? null : new Date(start),
        },
        sectionId,
        liveSince: liveSince === null ? null : new Date(liveSince),
        via: own.length ? [] : offers,
        feeds: matchFeeds(
            fixture.slots,
            fixture.teams,
            own.length ? [] : offers,
            context
        ),
        // Its feed's category names where it plays, unless that names
        // another sport (a Ligue 1 match under Formula 1): no "Ver en F1".
        channelName: own[0]
            ? misfiled(sectionId, own[0])
                ? null
                : categoryChannelName(own[0].categoryName)
            : (offers[0]?.name ?? null),
    };
}

function misfiled(sectionId: SportSectionId, slot: EventSlot): boolean {
    return namesOtherSport(sectionId, slot.categoryName);
}

/** When the first of its "Live" feeds was so named (ms), if the panel says. */
function earliestLiveName(slots: readonly EventSlot[]): number | null {
    let earliest: number | null = null;
    for (const slot of slots) {
        const at = slot.event.status === 'live' ? slot.namedAt : null;
        if (at && (earliest === null || at < earliest)) {
            earliest = at;
        }
    }
    return earliest;
}

function isKept(slot: EventSlot): boolean {
    return slot.kept;
}

/**
 * The latest kick-off the slots give (one feed's time can be its studio
 * show's), or null.
 */
function latestStart(slots: readonly EventSlot[]): number | null {
    let latest: number | null = null;
    for (const slot of slots) {
        const start = slot.event.start?.getTime();
        if (start !== undefined && (latest === null || start > latest)) {
            latest = start;
        }
    }
    return latest;
}

/** Argentina's feeds first (TiagoTV's owner), then Spain's, then English. */
function byRegion(a: EventSlot, b: EventSlot): number {
    return regionRank(a.categoryName) - regionRank(b.categoryName);
}

function regionRank(categoryName: string): number {
    const code = categoryLanguageCode(categoryName);
    return code === 'LAT' ? 0 : code === 'ES' ? 1 : 2;
}
