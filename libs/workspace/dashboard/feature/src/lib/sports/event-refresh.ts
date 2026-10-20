import {
    eventCategoryIds,
    fixtureCategoryIds,
    listingCategoryIds,
    reloadedAll,
    reloadEventCategories,
    streamsByCategory,
    withFreshEvents,
    type CategoryStreams,
    type LiveCatalog,
} from './live-catalog';
import type { SportSectionId } from './sport-sections';
import type { SportsCatalogStream } from './sports-catalog';

/**
 * Event channels rename themselves through the day; their categories are
 * reloaded at most this often (finished matches leave "today" by the
 * clock, see match-clock, not by a reload).
 */
export const FRESH_MS = 10 * 60 * 1000;
/**
 * Other languages' fixture categories (see fixtureCategoryIds) add the
 * matches no kept feed names, announced hours ahead: they are reloaded
 * this often, and with the others while one of those matches is on (its
 * "End" shows there first).
 */
const FIXTURES_MS = 60 * 60 * 1000;
/** The pause between two category requests: the provider is load-sensitive. */
const GAP_MS = 500;

/** A playlist's event categories as last reloaded from the panel. */
interface Held {
    readonly playlistId: string;
    readonly streams: CategoryStreams;
    readonly at: number;
    /** When the other languages' fixture categories last were. */
    readonly fixturesAt: number;
}

/** The stored catalog with the event channels of one reload. */
export interface EventRound {
    readonly live: LiveCatalog;
    /** When its event categories were reloaded (0: not yet). */
    readonly at: number;
}

export interface ReloadOptions {
    /** The competitions whose matches other languages' feeds may add. */
    readonly sections: () => ReadonlySet<SportSectionId>;
    /** A match only other languages' feeds name is on now. */
    readonly foreignMatchOn: boolean;
    /** The competitions with a match on now (see listingCategoryIds). */
    readonly liveSections?: ReadonlySet<SportSectionId>;
    readonly fetchCategory: (
        categoryId: string
    ) => Promise<readonly SportsCatalogStream[]>;
}

/**
 * The event categories of a playlist's live catalog, reloaded from the
 * panel one at a time (see reloadEventCategories): the kept (Spanish and
 * English) ones every FRESH_MS, with the numbered listings of the
 * competitions on now, then other languages' fixture categories.
 */
export class EventRefresh {
    private held: Held | null = null;

    /** The stored copy with the lists last reloaded, however old. */
    current(playlistId: string, stored: LiveCatalog): EventRound {
        const held = this.heldFor(playlistId);
        return {
            live: withHeld(stored, held?.streams ?? new Map()),
            at: held?.at ?? 0,
        };
    }

    /** The same, while its lists are within FRESH_MS; else null. */
    fresh(playlistId: string, stored: LiveCatalog): EventRound | null {
        const held = this.heldFor(playlistId);
        return held && Date.now() - held.at < FRESH_MS
            ? this.current(playlistId, stored)
            : null;
    }

    /** Reloads the event categories due, the kept ones first. */
    async reload(
        playlistId: string,
        stored: LiveCatalog,
        options: ReloadOptions
    ): Promise<EventRound> {
        const held = this.heldFor(playlistId);
        const previous = held?.streams ?? new Map();
        const fixturesDue =
            !held ||
            Date.now() - held.fixturesAt >= FIXTURES_MS ||
            options.foreignMatchOn;
        const fixtureIds = fixturesDue
            ? fixtureCategoryIds(stored, options.sections(), previous)
            : [];
        const eventIds = eventCategoryIds(stored);
        const listingIds = listingCategoryIds(
            stored,
            options.liveSections ?? new Set()
        ).filter((id) => !eventIds.includes(id));
        const streams = await reloadEventCategories(
            eventIds.concat(listingIds, fixtureIds),
            options.fetchCategory,
            previous,
            GAP_MS
        );
        const at = Date.now();
        this.held = {
            playlistId,
            streams,
            at,
            fixturesAt:
                fixturesDue && reloadedAll(fixtureIds, streams, previous)
                    ? at
                    : (held?.fixturesAt ?? 0),
        };
        return { live: withHeld(stored, streams), at };
    }

    /** First run: the whole line-up, downloaded now, holds today's events. */
    keepDownload(
        playlistId: string,
        live: LiveCatalog,
        sections: ReadonlySet<SportSectionId>,
        at: number
    ): void {
        const ids = eventCategoryIds(live).concat(
            fixtureCategoryIds(live, sections)
        );
        this.held = {
            playlistId,
            streams: streamsByCategory(live.streams, ids),
            at,
            fixturesAt: at,
        };
    }

    private heldFor(playlistId: string): Held | null {
        return this.held?.playlistId === playlistId ? this.held : null;
    }
}

/**
 * The stored copy with the lists held: the kept event categories', and
 * other languages' reloaded earlier while the copy lists them (a parental
 * lock may withhold one).
 */
function withHeld(stored: LiveCatalog, streams: CategoryStreams): LiveCatalog {
    const ids = eventCategoryIds(stored);
    const listed = new Set(
        stored.categories.map((category) => String(category.category_id))
    );
    streams.forEach((_list, id) => {
        if (listed.has(id) && !ids.includes(id)) {
            ids.push(id);
        }
    });
    return withFreshEvents(stored, ids, streams);
}
