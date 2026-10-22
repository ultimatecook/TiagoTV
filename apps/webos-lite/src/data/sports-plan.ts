import { isSpanishOrEnglishCategory } from '@iptvnator/shared/interfaces';
import {
    channelInSection,
    isIdleEventChannel,
    isSectionCategory,
    parseSportEvent,
    sectionForCompetition,
    SPORT_SECTIONS,
    type SportSectionId,
    type SportsCatalogStream,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { StorageLike } from '../core/storage';
import type { XtreamCategory } from '../xtream/client';

/**
 * Which live categories Deportes asks for, as the desktop's sports service
 * does without the TV holding the whole line-up: what each category held
 * last time is noted (and kept across launches), so
 *
 *   - the kept (Spanish and English) categories that hold event channels
 *     ("Live | …", "Next | …") are asked on every refresh, first;
 *   - the kept competition categories without any reuse their channel
 *     list for a day;
 *   - other languages' categories are read for their fixtures only (a
 *     LaLiga match that only a French feed names), when their name or
 *     what they named before ties them to a competition the viewer's
 *     channels show, and the rest of their event categories are looked
 *     through every few hours.
 *
 * Nothing is capped by count: 0.2.1 took the first 30, event categories
 * first, and lost competitions' categories that held matches or channels.
 */
const EVENT_CATEGORY = /\b(events?|eventos?|ppv)\b/i;
const HOUR = 3600 * 1000;
const LIST_MS = 24 * HOUR;
const EMPTY_EVENTS_MS = HOUR;
export const DISCOVER_MS = 6 * HOUR;
const NOTES_KEY = 'tiagotv-lite:sports:v1:';

export interface CategoryNote {
    readonly at: number;
    /** It held event channels. */
    readonly events: boolean;
    /** The sections of the two-sided matches it named. */
    readonly named: readonly SportSectionId[];
    /** A kept category's channels, when none is an event slot. */
    readonly streams?: readonly SportsCatalogStream[];
}

export function isEventSlot(name: string): boolean {
    return parseSportEvent(name) !== null || isIdleEventChannel(name);
}

export function isKeptLive(category: XtreamCategory): boolean {
    return isSpanishOrEnglishCategory(category.category_name, 'live');
}

export class SportsNotes {
    private readonly notes: Record<string, CategoryNote>;
    private readonly key: string;

    constructor(
        scope: string,
        private readonly storage: StorageLike | null
    ) {
        this.key = NOTES_KEY + scope;
        let parsed: unknown = null;
        try {
            const raw = storage ? storage.getItem(this.key) : null;
            parsed = raw ? JSON.parse(raw) : null;
        } catch {
            parsed = null;
        }
        this.notes = parsed && typeof parsed === 'object' ? (parsed as Record<string, CategoryNote>) : {};
    }

    get(id: string): CategoryNote | null {
        return this.notes[id] ?? null;
    }

    /** What `streams` of category `id` held, as of `now`. */
    record(id: string, streams: readonly SportsCatalogStream[], kept: boolean, now: number): void {
        let events = false;
        const named: SportSectionId[] = [];
        for (const stream of streams) {
            if (!isEventSlot(stream.name)) {
                continue;
            }
            events = true;
            const event = parseSportEvent(stream.name);
            const section = event && event.home && event.away ? sectionForCompetition(event.competition, event.title) : null;
            if (section && named.indexOf(section.id) < 0) {
                named.push(section.id);
            }
        }
        this.notes[id] = { at: now, events, named, ...(kept && !events ? { streams: streams.slice() } : {}) };
    }

    save(): void {
        try {
            this.storage?.setItem(this.key, JSON.stringify(this.notes));
        } catch {
            // A full storage only costs the next launch a few requests.
        }
    }
}

export interface KeptPlan {
    /** Event categories: asked first, every time. */
    readonly events: string[];
    /** Competition categories whose list is not kept (or is a day old). */
    readonly others: string[];
    /** The channel lists kept from earlier loads, by category. */
    readonly stored: Map<string, readonly SportsCatalogStream[]>;
}

/** A competition's own category, or its broadcasters' country's ("|LAT| ✪ ARGENTINA"). */
function isCompetition(name: string): boolean {
    return isSectionCategory(name);
}

export function planKept(categories: readonly XtreamCategory[], notes: SportsNotes, now: number): KeptPlan {
    const plan: KeptPlan = { events: [], others: [], stored: new Map() };
    for (const category of categories) {
        const name = category.category_name;
        const eventNamed = EVENT_CATEGORY.test(name);
        if (!isKeptLive(category) || (!eventNamed && !isCompetition(name))) {
            continue;
        }
        const id = String(category.category_id);
        const note = notes.get(id);
        if (note && !note.events && note.streams && now - note.at < (eventNamed ? EMPTY_EVENTS_MS : LIST_MS)) {
            plan.stored.set(id, note.streams);
        } else if (eventNamed || (note && note.events)) {
            plan.events.push(id);
        } else {
            plan.others.push(id);
        }
    }
    return plan;
}

export interface ForeignPlan {
    /** Tied to a followed competition: asked with the kept ones. */
    readonly fixtures: string[];
    /** Event categories looked through every DISCOVER_MS, last. */
    readonly discover: string[];
}

/** Other languages' categories to read for `followed` competitions' fixtures. */
export function planForeign(
    categories: readonly XtreamCategory[],
    notes: SportsNotes,
    followed: ReadonlySet<SportSectionId>,
    now: number
): ForeignPlan {
    const plan: ForeignPlan = { fixtures: [], discover: [] };
    const sections = SPORT_SECTIONS.filter((section) => followed.has(section.id));
    for (const category of categories) {
        if (isKeptLive(category)) {
            continue;
        }
        const name = category.category_name;
        const id = String(category.category_id);
        const note = notes.get(id);
        const byName = sections.some((section) => channelInSection(section, name, name));
        const named = !!note && note.named.some((section) => followed.has(section));
        if (named || (byName && (!note || note.events || now - note.at > EMPTY_EVENTS_MS))) {
            plan.fixtures.push(id);
        } else if (!byName && EVENT_CATEGORY.test(name) && (!note || now - note.at > DISCOVER_MS)) {
            plan.discover.push(id);
        }
    }
    return plan;
}
