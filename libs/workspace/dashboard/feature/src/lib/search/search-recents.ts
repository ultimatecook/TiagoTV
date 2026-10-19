/**
 * The search page's recent searches: the last terms looked up on this
 * device, newest first, kept in local storage (a convenience: an
 * unavailable storage just means no history).
 */
export const RECENT_SEARCHES_KEY = 'tiagotv:recent-searches:v1';
export const RECENT_SEARCHES_MAX = 8;

type RecentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readRecentSearches(storage: RecentStorage | null): string[] {
    try {
        const parsed: unknown = JSON.parse(
            storage?.getItem(RECENT_SEARCHES_KEY) ?? '[]'
        );
        return Array.isArray(parsed)
            ? parsed
                  .filter((term): term is string => typeof term === 'string')
                  .map((term) => term.trim())
                  .filter(Boolean)
                  .slice(0, RECENT_SEARCHES_MAX)
            : [];
    } catch {
        return [];
    }
}

/** `term` first, without its earlier copy (in any case), at most MAX. */
export function withRecentSearch(
    recent: readonly string[],
    term: string
): string[] {
    const clean = term.trim().replace(/\s+/g, ' ');
    if (!clean) {
        return [...recent];
    }
    const lower = clean.toLowerCase();
    return [
        clean,
        ...recent.filter((entry) => entry.toLowerCase() !== lower),
    ].slice(0, RECENT_SEARCHES_MAX);
}

export function writeRecentSearches(
    storage: RecentStorage | null,
    recent: readonly string[]
): void {
    try {
        if (recent.length === 0) {
            storage?.removeItem(RECENT_SEARCHES_KEY);
        } else {
            storage?.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
        }
    } catch {
        // Private mode or a full quota: the history is only a convenience.
    }
}

export function browserStorage(): RecentStorage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}
