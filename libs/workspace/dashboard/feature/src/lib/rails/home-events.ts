import { isFollowedTeam } from '../sports/my-teams';
import { findSportSection } from '../sports/sport-sections';
import type { SportMatch } from '../sports/sports-catalog';

/**
 * The Home's "Eventos de hoy" list (README 01 · Inicio, 4): today's
 * matches and events in one card, the ones on now first, the user's teams
 * in bold. Scores and minutes are not in the provider's data, so a row
 * says "en vivo" or its kick-off, never a made-up score.
 */
export interface HomeEventRow {
    readonly key: string;
    readonly live: boolean;
    /** Local kick-off, when the feeds announce one. */
    readonly kickOff: Date | null;
    readonly competition: string;
    readonly logo: string | null;
    readonly tint: string;
    /** Both sides, or null for an event without two (a race, a session). */
    readonly home: string | null;
    readonly away: string | null;
    readonly title: string;
    readonly homeMine: boolean;
    readonly awayMine: boolean;
    /** Where it plays: "DAZN LaLiga", "Premier League PPV". */
    readonly channel: string;
    /** What a click opens: its competition's page, playing its feed. */
    readonly match: SportMatch;
}

/** Rows the card lists; "Ver todo" opens the rest. */
export const HOME_EVENTS_LIMIT = 8;

/** A match of the owner's teams (`MY_TEAMS`, sports/my-teams.ts). */
export function involvesMyTeam(match: SportMatch): boolean {
    return isFollowedTeam(match.event.home) || isFollowedTeam(match.event.away);
}

/**
 * The rows the card shows, in the order given (the ones on now first):
 * the first `limit`, except that a match of the user's teams further down
 * takes the place of the last other one.
 */
export function selectHomeEvents(
    matches: readonly SportMatch[],
    limit = HOME_EVENTS_LIMIT
): SportMatch[] {
    const mine = new Set(matches.filter(involvesMyTeam));
    const shown = matches.slice(0, limit);
    for (const match of matches.slice(limit)) {
        if (!mine.has(match)) {
            continue;
        }
        const index = lastIndexWhere(shown, (item) => !mine.has(item));
        if (index === -1) {
            break;
        }
        shown.splice(index, 1);
        shown.push(match);
    }
    return shown;
}

/** One row; its channel is the one the match plays on (`channelName`). */
export function homeEventRow(match: SportMatch, live: boolean): HomeEventRow {
    const section = findSportSection(match.sectionId);
    const { home, away } = match.event;
    const twoSided = !!home && !!away;
    return {
        key: match.key,
        live,
        kickOff: match.event.start,
        competition:
            twoSided && section && !section.catchAll
                ? section.title
                : match.event.competition,
        logo: section?.logo ?? null,
        tint: section?.tint ?? '#2a2a2a',
        home: twoSided ? home : null,
        away: twoSided ? away : null,
        title: match.title,
        homeMine: twoSided && isFollowedTeam(home),
        awayMine: twoSided && isFollowedTeam(away),
        channel: match.channelName ?? match.via[0]?.name ?? '',
        match,
    };
}

/** How many of today's events are on now, and how many there are. */
export function homeEventsSummary(
    matches: readonly SportMatch[],
    isLive: (match: SportMatch) => boolean
): { readonly live: number; readonly total: number } {
    return {
        live: matches.filter(isLive).length,
        total: matches.length,
    };
}

function lastIndexWhere<T>(list: readonly T[], test: (item: T) => boolean) {
    for (let index = list.length - 1; index >= 0; index--) {
        if (test(list[index])) {
            return index;
        }
    }
    return -1;
}
