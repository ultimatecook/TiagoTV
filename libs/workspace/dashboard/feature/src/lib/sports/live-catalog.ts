import type { XtreamCategory } from '@iptvnator/shared/interfaces';
import { isSpanishOrEnglishCategory } from '@iptvnator/shared/interfaces';
import type { XtreamCategoryFromDb } from '@iptvnator/portal/xtream/data-access';
import { isIdleEventChannel, parseSportEvent } from './sport-events';
import type {
    SportsCatalogCategory,
    SportsCatalogStream,
} from './sports-catalog';

/** The source's live categories and channels, as the panel lists them. */
export interface LiveCatalog {
    readonly categories: readonly SportsCatalogCategory[];
    readonly streams: readonly SportsCatalogStream[];
}

/** One category's channels, by its provider id. */
export type CategoryStreams = ReadonlyMap<
    string,
    readonly SportsCatalogStream[]
>;

/**
 * A live row of the app's stored catalog: the SQLite wire shape in
 * Electron (`xtream_id`, `title`, `poster_url`, the category's row id), the
 * panel's own fields (kept by the session cache) in the browser build.
 */
export interface StoredLiveStream {
    readonly stream_id?: number | string;
    readonly xtream_id?: number;
    readonly name?: string;
    readonly title?: string;
    readonly stream_icon?: string | null;
    readonly poster_url?: string | null;
    readonly category_id?: number | string | null;
    readonly is_adult?: number | string | null;
}

/** A channel that carries a match by name: "Live | …", "Next | …", "ES | No Event". */
export function isEventSlot(name: string): boolean {
    return parseSportEvent(name) !== null || isIdleEventChannel(name);
}

/**
 * The stored catalog in the panel's shape, with the provider's category
 * ids: `fromSqlite` rows point at their category's row id.
 */
export function toLiveCatalog(
    categoryRows: readonly (XtreamCategory | XtreamCategoryFromDb)[],
    streamRows: readonly StoredLiveStream[],
    fromSqlite: boolean
): LiveCatalog {
    const providerIdOfRow = new Map<string, string>();
    const categories = categoryRows.map((row): SportsCatalogCategory => {
        if ('xtream_id' in row) {
            providerIdOfRow.set(String(row.id), String(row.xtream_id));
            return {
                category_id: String(row.xtream_id),
                category_name: row.name,
            };
        }
        return {
            category_id: String(row.category_id),
            category_name: row.category_name,
        };
    });

    const streams: SportsCatalogStream[] = [];
    for (const row of streamRows) {
        const streamId = row.stream_id ?? row.xtream_id;
        const name = row.name ?? row.title;
        if (streamId === undefined || name === undefined) {
            continue;
        }
        const categoryId = fromSqlite
            ? (providerIdOfRow.get(String(row.category_id)) ?? null)
            : (row.category_id ?? null);
        streams.push({
            stream_id: streamId,
            name,
            stream_icon: row.stream_icon || row.poster_url || null,
            category_id: categoryId,
            ...(row.is_adult !== undefined ? { is_adult: row.is_adult } : {}),
        });
    }
    return { categories, streams };
}

/**
 * The Spanish and English categories that hold event channels: the only
 * part of the line-up whose names change through the day.
 */
export function eventCategoryIds(live: LiveCatalog): string[] {
    const kept = new Set<string>();
    for (const category of live.categories) {
        if (isSpanishOrEnglishCategory(category.category_name, 'live')) {
            kept.add(String(category.category_id));
        }
    }
    const withEvents = new Set<string>();
    for (const stream of live.streams) {
        const id = String(stream.category_id ?? '');
        if (kept.has(id) && !withEvents.has(id) && isEventSlot(stream.name)) {
            withEvents.add(id);
        }
    }
    return live.categories
        .map((category) => String(category.category_id))
        .filter((id) => withEvents.has(id));
}

/** The channels of each of `ids`, from a whole line-up. */
export function streamsByCategory(
    streams: readonly SportsCatalogStream[],
    ids: readonly string[]
): Map<string, SportsCatalogStream[]> {
    const lists = new Map<string, SportsCatalogStream[]>();
    for (const id of ids) {
        lists.set(id, []);
    }
    for (const stream of streams) {
        lists.get(String(stream.category_id ?? ''))?.push(stream);
    }
    return lists;
}

/**
 * The stored catalog with today's event channels: each event category
 * reloaded from the panel takes its fresh list (where its stored list
 * stood); the others drop their event channels, whose names belong to the
 * day the catalog was stored.
 */
export function withFreshEvents(
    stored: LiveCatalog,
    eventIds: readonly string[],
    fresh: CategoryStreams
): LiveCatalog {
    const events = new Set(eventIds);
    const placed = new Set<string>();
    const streams: SportsCatalogStream[] = [];
    const place = (id: string, list: readonly SportsCatalogStream[]) => {
        placed.add(id);
        for (const stream of list) {
            streams.push(stream);
        }
    };
    for (const stream of stored.streams) {
        const id = String(stream.category_id ?? '');
        const list = events.has(id) ? fresh.get(id) : undefined;
        if (list) {
            if (!placed.has(id)) {
                place(id, list);
            }
        } else if (!events.has(id) || !isEventSlot(stream.name)) {
            streams.push(stream);
        }
    }
    fresh.forEach((list, id) => {
        if (events.has(id) && !placed.has(id)) {
            place(id, list);
        }
    });
    return { categories: stored.categories, streams };
}

/**
 * Reloads the event categories from the panel one at a time, `gapMs`
 * apart. A failed request ends the round (the provider is struggling): the
 * categories not reloaded keep their `previous` list, and the next round
 * tries again. A panel that ignores the category and answers with its
 * whole line-up serves every event category at once.
 */
export async function reloadEventCategories(
    ids: readonly string[],
    fetchCategory: (id: string) => Promise<readonly SportsCatalogStream[]>,
    previous: CategoryStreams,
    gapMs: number
): Promise<CategoryStreams> {
    const fresh = new Map(previous);
    for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, gapMs));
        }
        let streams: readonly SportsCatalogStream[];
        try {
            streams = await fetchCategory(id);
        } catch {
            break;
        }
        const foreign = streams.filter(
            (stream) => String(stream.category_id ?? '') !== id
        ).length;
        if (foreign > streams.length / 2) {
            streamsByCategory(streams, ids).forEach((list, other) =>
                fresh.set(other, list)
            );
            break;
        }
        fresh.set(id, streams);
    }
    return fresh;
}
