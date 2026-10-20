import { longestEvent } from '../sports/match-clock';
import { sectionForCompetition } from '../sports/sport-sections';
import {
    isIdleEventChannel,
    isStaleSlot,
    parseSportEvent,
    type SportEvent,
} from '../sports/sport-events';
import { cleanChannelTitle, namedAt } from '../sports/sports-catalog';

/**
 * Event and pay-per-view slots that carry nothing to watch, left off "Por
 * países": a slot waiting for its match ("ES | No Event", "LIVE EVENT 03 -
 * NO EVENT"), a match that ended ("End | Udinese - Lecce | Serie A"), a
 * broadcast window that closed ("UFC 00: CAGE WARRIORS start:… stop:…"),
 * a numbered slot or a dated game from before yesterday (`isStaleSlot`),
 * and, in a category of slots, a slot that names no event at all
 * ("LALIGA+ PPV 3", "RFEF 12", "GAAGO 04 (EVENTS)", "TNT Sports | Event 2").
 *
 * The clock retires the rest, as the sports views' (see match-clock) do:
 * a match announced for a time ("Next | 2026-10-18 | 13:00 (GMT) | …")
 * once it has run longer than its competition's matches ever do, one the
 * panel named "Live" (its `added`) as long ago, a feed waiting for a match
 * with no time that kept its name for days, and, in a category of slots,
 * a numbered slot still named after an event a week on ("LIVE EVENT 26 -
 * MAIN STAGE Live From Coachella 2026", renamed in April).
 */

/** Categories made of slots: pay-per-view, events, a league's games. */
const SLOT_CATEGORY =
    /\b(ppv|events?|eventos|board|wnba|nhl|nfl|mlb|mls|boxing|ufc)\b/i;
/**
 * "LALIGA+ PPV 3", "2RFEF 1", "NETFLIX 01 Events Only", "TNT Sports |
 * Event 2", "NHL | 03 -", "BOXING PPV 00:".
 */
const NAMELESS_SLOT =
    /^(?:\d\p{L}+\s*)?[\p{L}+&.'\s|:-]*?\s*\d{1,3}\s*(\(\s*events?\s*\)|events? only)?[\s|:-]*$/iu;
/** A slot's own broadcast window: "start:2026-10-17 17:55:00 stop:…". */
const WINDOW =
    /\s*start:\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?\s*stop:\s*(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?\s*$/i;
/** The window's times are the panel's own clock: allow for its zone. */
const WINDOW_GRACE_MS = 6 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** Hiding a channel costs more than a late one: a match's feed stays a while. */
const EVENT_GRACE_MS = HOUR_MS / 2;
/** An event feed with no kick-off that kept its name this long names a past one. */
const UNTIMED_EVENT_MS = 2 * 24 * HOUR_MS;
/**
 * A numbered slot named after its event ("LIVE EVENT 26 - Coachella",
 * "NFL | 02 - 9:30am Texans at Jaguars", "ULSTER GAA 01 | Keady"): named
 * days ahead at most (a weekend's games midweek), and renamed for the next.
 */
const NAMED_SLOT = /^[\p{L}+&.'\s|]*?\d{1,3}\s*[-|:]\s*\S/u;
const NAMED_SLOT_MS = 7 * 24 * HOUR_MS;
/**
 * A US pay-per-view slot's game with its time, Eastern ("Cincinnati vs
 * Columbus @ Oct 18 4:30 PM"): over this long after it, whatever the sport.
 */
const DATED_GAME = /@\s*([a-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([ap]m)/i;
const DATED_GAME_MS = 6 * HOUR_MS;
/** Eastern time is UTC-4 or -5: the later one, so no game ends early. */
const EASTERN_OFFSET_HOURS = 5;
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

/**
 * Whether a channel of a category labelled `label` carries nothing;
 * `added` is when the panel last named it (epoch seconds), if known.
 */
export function isEmptySlot(
    rawName: string,
    label: string | null,
    now = new Date(),
    added: string | number | null = null
): boolean {
    if (isIdleEventChannel(rawName) || /\bno event\b/i.test(rawName)) {
        return true;
    }
    const named = namedAt(added);
    const event = parseSportEvent(rawName);
    if (event) {
        return event.status === 'end' || isEventOver(event, named, now);
    }
    const title = cleanChannelTitle(rawName);
    if (isStaleSlot(title, now) || isPastGame(title, now)) {
        return true;
    }
    const window = slotWindow(title);
    if (window && window.stop.getTime() + WINDOW_GRACE_MS < now.getTime()) {
        return true;
    }
    if (!label || !SLOT_CATEGORY.test(label)) {
        return false;
    }
    const slot = stripWindow(title).trim();
    return (
        NAMELESS_SLOT.test(slot) ||
        (!window &&
            named !== null &&
            NAMED_SLOT.test(slot) &&
            now.getTime() - named > NAMED_SLOT_MS)
    );
}

/**
 * Whether an event feed's match is over: past its kick-off, or the time
 * the panel named it "Live", by longer than its competition's matches run.
 */
function isEventOver(
    event: SportEvent,
    named: number | null,
    now: Date
): boolean {
    const section = sectionForCompetition(event.competition, event.title);
    const lasts = longestEvent(event.title, section?.id ?? null);
    const since = (start: number) => now.getTime() - start;
    if (event.status === 'next') {
        return event.start
            ? since(event.start.getTime()) > lasts + EVENT_GRACE_MS
            : named !== null && since(named) > UNTIMED_EVENT_MS;
    }
    return named !== null && since(named) > lasts + EVENT_GRACE_MS;
}

/** Whether a slot's dated game ("@ Oct 18 4:30 PM", Eastern) is over. */
function isPastGame(title: string, now: Date): boolean {
    const game = DATED_GAME.exec(title);
    const month = game ? MONTHS.indexOf(game[1].toLowerCase()) : -1;
    if (!game || month < 0) {
        return false;
    }
    const hour = (Number(game[3]) % 12) + (/p/i.test(game[5]) ? 12 : 0);
    const at = (year: number) =>
        Date.UTC(
            year,
            month,
            Number(game[2]),
            hour + EASTERN_OFFSET_HOURS,
            Number(game[4])
        );
    let start = at(now.getUTCFullYear());
    // A December game seen in January belongs to last year.
    if (start - now.getTime() > 180 * 24 * HOUR_MS) {
        start = at(now.getUTCFullYear() - 1);
    }
    return now.getTime() - start > DATED_GAME_MS;
}

/** The broadcast window a slot's name ends with, if any. */
export function slotWindow(title: string): { start: Date; stop: Date } | null {
    const match = WINDOW.exec(title);
    if (!match) {
        return null;
    }
    const start = new Date(`${match[1]}T${match[2]}:00Z`);
    const stop = new Date(`${match[3]}T${match[4]}:00Z`);
    return Number.isFinite(start.getTime()) && Number.isFinite(stop.getTime())
        ? { start, stop }
        : null;
}

/** The name without its broadcast window: "UFC 03 : CAGE WARRIORS 211". */
export function stripWindow(title: string): string {
    return title.replace(WINDOW, '');
}
