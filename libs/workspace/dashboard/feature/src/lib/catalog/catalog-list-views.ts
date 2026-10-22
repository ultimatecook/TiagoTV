import type { PlatformTitle } from '../platforms/platform-titles';
import { mergePlatformTitles } from '../platforms/platform-versions';
import type {
    PlatformCategory,
    PlatformShelf,
} from '../platforms/streaming-platforms';
import {
    aggregateCatalog,
    type CatalogKind,
    type CatalogTitle,
    type PlatformTitleList,
} from './catalog-titles';

/**
 * From the platforms' own lists alone, Series / Películas show nothing
 * until this many platforms answered (or all, where fewer carry the kind):
 * never one platform's titles as if they were the whole catalog.
 */
export const MIN_ANSWERED_PLATFORMS = 3;

/** What the platforms' lists of one kind hold so far. */
export interface PlatformListsView {
    readonly lists: readonly PlatformTitleList[];
    /** The platforms carrying the kind, by the source's categories. */
    readonly total: number;
    /** Of those, the ones that answered (or failed) at least once. */
    readonly answered: number;
    /** Of those, the ones every request of which failed. */
    readonly failed: number;
}

/** How far one platform's lists (both kinds) got. */
export interface PlatformListsProgress {
    readonly total: number;
    readonly answered: number;
    readonly failed: number;
    readonly loading: boolean;
}

/** A category's answer (its titles) and whether its last request failed. */
export interface CategoryLookup {
    readonly titlesOf: (
        category: PlatformCategory
    ) => readonly PlatformTitle[] | undefined;
    readonly failed: (category: PlatformCategory) => boolean;
}

export function categoriesOfKind(
    categories: readonly PlatformCategory[],
    kind: CatalogKind
): PlatformCategory[] {
    return categories.filter((category) => category.kind === kind);
}

/** One list per platform carrying the kind, from what answered. */
export function listsView(
    shelves: readonly PlatformShelf[],
    kind: CatalogKind,
    lookup: CategoryLookup
): PlatformListsView {
    const lists: PlatformTitleList[] = [];
    let total = 0;
    let answered = 0;
    let failed = 0;
    for (const shelf of shelves) {
        const categories = categoriesOfKind(shelf.categories, kind);
        if (categories.length === 0) {
            continue;
        }
        total++;
        const loaded = categories
            .map((category) => lookup.titlesOf(category))
            .filter((titles) => !!titles) as (readonly PlatformTitle[])[];
        if (loaded.length > 0) {
            lists.push({
                platform: shelf.platform,
                titles: mergePlatformTitles(loaded),
            });
        }
        if (loaded.length > 0 || categories.some(lookup.failed)) {
            answered++;
        }
        if (loaded.length === 0 && categories.every(lookup.failed)) {
            failed++;
        }
    }
    return { lists, total, answered, failed };
}

/** A platform's titles, both kinds, or null until one of its lists answered. */
export function platformTitlesOf(
    shelf: PlatformShelf | undefined,
    lookup: CategoryLookup
): PlatformTitle[] | null {
    const loaded = (shelf?.categories ?? [])
        .map((category) => lookup.titlesOf(category))
        .filter((titles) => !!titles) as (readonly PlatformTitle[])[];
    return loaded.length > 0 ? mergePlatformTitles(loaded) : null;
}

export function progressOf(
    shelf: PlatformShelf | undefined,
    lookup: CategoryLookup,
    loading: boolean
): PlatformListsProgress {
    const categories = shelf?.categories ?? [];
    const answered = categories.filter((category) => lookup.titlesOf(category));
    return {
        total: categories.length,
        answered: answered.length,
        failed: categories.filter(
            (category) => lookup.failed(category) && !lookup.titlesOf(category)
        ).length,
        loading,
    };
}

/**
 * Series / Películas from both of their sources, one list per platform:
 * the platforms' own lists first (they name genres, ratings and years),
 * then the stored titles they lack. A stored title the lists carry, under
 * any platform, is left to them.
 */
export function unionPlatformLists(
    listed: readonly PlatformTitleList[],
    stored: readonly PlatformTitleList[]
): PlatformTitleList[] {
    const listedIds = new Set<string>();
    for (const list of listed) {
        for (const title of list.titles) {
            for (const version of [title, ...title.versions]) {
                listedIds.add(`${title.kind}:${version.id}`);
            }
        }
    }
    const order: PlatformTitleList['platform'][] = [];
    const byPlatform = new Map<string, PlatformTitle[]>();
    const add = (list: PlatformTitleList, titles: readonly PlatformTitle[]) => {
        let into = byPlatform.get(list.platform.id);
        if (!into) {
            into = [];
            byPlatform.set(list.platform.id, into);
            order.push(list.platform);
        }
        into.push(...titles);
    };
    for (const list of listed) {
        add(list, list.titles);
    }
    for (const list of stored) {
        add(
            list,
            list.titles.filter(
                (title) => !listedIds.has(`${title.kind}:${title.id}`)
            )
        );
    }
    return order.map((platform) => ({
        platform,
        titles: byPlatform.get(platform.id) ?? [],
    }));
}

/**
 * Series / Películas: the stored catalog with the platforms' lists, once it
 * is read; before that (or with nothing stored, `expected`: the import runs
 * or the lists are all there is), the lists alone, once enough platforms
 * answered. Null while there is nothing to show yet.
 */
export function catalogTitles(
    kind: CatalogKind,
    view: PlatformListsView,
    state: {
        readonly stored: readonly PlatformTitleList[] | null;
        readonly expected: boolean;
        readonly busy: boolean;
        readonly failed: () => boolean;
    }
): CatalogTitle[] | null {
    if (state.stored) {
        return aggregateCatalog(
            unionPlatformLists(view.lists, state.stored),
            kind
        );
    }
    // Lists already known (kept from the last launch, or loaded by a
    // platform's page) show on the same terms.
    if (!state.expected && !view.lists.some((list) => list.titles.length > 0)) {
        return null;
    }
    if (
        state.busy &&
        view.answered < Math.min(MIN_ANSWERED_PLATFORMS, view.total)
    ) {
        return null;
    }
    const titles = aggregateCatalog(view.lists, kind);
    // None yet: the platforms are still loading, failed, or carry none.
    return titles.length > 0 || (!state.busy && !state.failed())
        ? titles
        : null;
}
