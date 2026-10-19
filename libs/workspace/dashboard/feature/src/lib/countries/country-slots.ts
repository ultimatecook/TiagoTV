import {
    isIdleEventChannel,
    isStaleSlot,
    parseSportEvent,
} from '../sports/sport-events';
import { cleanChannelTitle } from '../sports/sports-catalog';

/**
 * Event and pay-per-view slots that carry nothing to watch, left off "Por
 * países": a slot waiting for its match ("ES | No Event", "LIVE EVENT 03 -
 * NO EVENT"), a match that ended ("End | Udinese - Lecce | Serie A"), a
 * broadcast window that closed ("UFC 00: CAGE WARRIORS start:… stop:…"),
 * a numbered slot or a dated game from before yesterday (`isStaleSlot`),
 * and, in a category of slots, a slot that names no event at all
 * ("LALIGA+ PPV 3", "RFEF 12", "GAAGO 04 (EVENTS)", "TNT Sports | Event 2").
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

/** Whether a channel of a category labelled `label` carries nothing. */
export function isEmptySlot(
    rawName: string,
    label: string | null,
    now = new Date()
): boolean {
    if (isIdleEventChannel(rawName) || /\bno event\b/i.test(rawName)) {
        return true;
    }
    if (parseSportEvent(rawName)?.status === 'end') {
        return true;
    }
    const title = cleanChannelTitle(rawName);
    if (isStaleSlot(title, now)) {
        return true;
    }
    const window = slotWindow(title);
    if (window && window.stop.getTime() + WINDOW_GRACE_MS < now.getTime()) {
        return true;
    }
    return (
        !!label &&
        SLOT_CATEGORY.test(label) &&
        NAMELESS_SLOT.test(stripWindow(title).trim())
    );
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
