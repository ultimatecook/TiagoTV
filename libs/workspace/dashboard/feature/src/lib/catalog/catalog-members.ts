import type { PlatformTitle } from '../platforms/platform-titles';
import type {
    PlatformShelf,
    StreamingPlatform,
} from '../platforms/streaming-platforms';
import type { CatalogKind } from './catalog-titles';

/**
 * Which titles each platform category holds, by the platform's own lists:
 * the provider files a title in several categories ("|EN| ✪ AMAZON-PRIME"
 * and "|EN| ✪ SERIES"), and the app's stored catalog keeps one of them per
 * title, often not the platform's. Keyed by the provider's category id;
 * the ids are the titles' stream (movie) or series ids.
 */
export type CategoryMembers = ReadonlyMap<string, ReadonlySet<number>>;

/** The members the platforms' loaded lists show, per category. */
export function membersOf(
    lists: readonly (readonly PlatformTitle[])[]
): Map<string, Set<number>> {
    const members = new Map<string, Set<number>>();
    for (const titles of lists) {
        for (const title of titles) {
            for (const version of [title, ...title.versions]) {
                const ids = members.get(version.categoryId) ?? new Set();
                ids.add(version.id);
                members.set(version.categoryId, ids);
            }
        }
    }
    return members;
}

/**
 * The categories `fresh` answered replace their old members; the ones it
 * lacks (a request that failed) keep the old.
 */
export function mergeMembers(
    old: CategoryMembers,
    fresh: CategoryMembers
): Map<string, ReadonlySet<number>> {
    const merged = new Map<string, ReadonlySet<number>>(old);
    for (const [categoryId, ids] of fresh) {
        merged.set(categoryId, ids);
    }
    return merged;
}

/** Title id → the categories of `wanted` that list it. */
export function categoriesById(
    members: CategoryMembers,
    wanted: ReadonlySet<string>
): Map<number, string[]> {
    const byId = new Map<number, string[]>();
    for (const [categoryId, ids] of members) {
        if (!wanted.has(categoryId)) {
            continue;
        }
        for (const id of ids) {
            const list = byId.get(id) ?? [];
            list.push(categoryId);
            byId.set(id, list);
        }
    }
    return byId;
}

/** Title id → the first platform (in the shelves' order) listing it. */
export function platformById(
    members: CategoryMembers,
    shelves: readonly PlatformShelf[],
    kind: CatalogKind
): Map<number, StreamingPlatform> {
    const byId = new Map<number, StreamingPlatform>();
    for (const shelf of shelves) {
        for (const category of shelf.categories) {
            if (category.kind !== kind) {
                continue;
            }
            for (const id of members.get(category.id) ?? []) {
                if (!byId.has(id)) {
                    byId.set(id, shelf.platform);
                }
            }
        }
    }
    return byId;
}

/** The members as stored: category id → ids. */
export function toStoredMembers(
    members: CategoryMembers
): Record<string, number[]> {
    const stored: Record<string, number[]> = {};
    for (const [categoryId, ids] of members) {
        stored[categoryId] = [...ids];
    }
    return stored;
}

/** Stored members back, dropping anything malformed. */
export function fromStoredMembers(stored: unknown): Map<string, Set<number>> {
    const members = new Map<string, Set<number>>();
    if (!stored || typeof stored !== 'object') {
        return members;
    }
    for (const [categoryId, ids] of Object.entries(stored)) {
        if (Array.isArray(ids)) {
            members.set(
                categoryId,
                new Set(ids.filter((id) => Number.isFinite(id)))
            );
        }
    }
    return members;
}
