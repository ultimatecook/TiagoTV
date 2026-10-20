import type { PlatformTitleKind } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { StorageLike } from '../core/storage';
import type { CatalogKind, XtreamCategory } from '../xtream/client';
import { pack, unpack, type RawItem } from './catalog-items';

/**
 * The catalog kept across launches in localStorage, so Inicio, Series and
 * Películas show at once on the next start: the category lists, and each
 * platform category's compact titles under its own key (a category that
 * fails to store costs only itself). webOS gives an origin about 5 MB,
 * strings count twice (UTF-16), and the account, Mi lista and the rest
 * live there too: the catalog stays under about 1M characters, each
 * category under its share. A full storage is caught, never thrown.
 */
const LISTS = 'tiagotv-lite:lists:v1:';
const ITEMS = 'tiagotv-lite:cat:v1:';
/** Kept copies older than this are not shown at all. */
export const KEEP_MS = 14 * 24 * 3600 * 1000;
/** Kept copies older than this are shown, and asked again in the background. */
export const REFRESH_MS = 12 * 3600 * 1000;
export const CATALOG_BUDGET = 1000000;
const SHARE_MAX = 120000;

export interface Kept<T> {
    readonly at: number;
    readonly value: T;
}

function defaultStorage(): StorageLike | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export class CatalogPersist {
    /** Writes that a full (or refusing) storage turned down. */
    refused = 0;

    constructor(
        private readonly storage: StorageLike | null = defaultStorage(),
        private readonly now: () => number = Date.now
    ) {}

    private read(key: string): { at: number; value: unknown } | null {
        try {
            const raw = this.storage ? this.storage.getItem(key) : null;
            const parsed = raw ? (JSON.parse(raw) as { at?: unknown; value?: unknown }) : null;
            if (!parsed || typeof parsed.at !== 'number' || this.now() - parsed.at > KEEP_MS) {
                return null;
            }
            return { at: parsed.at, value: parsed.value };
        } catch {
            return null;
        }
    }

    private write(key: string, value: unknown): boolean {
        if (!this.storage) {
            return false;
        }
        try {
            this.storage.setItem(key, JSON.stringify({ at: this.now(), value }));
            return true;
        } catch {
            // QuotaExceeded: drop this key's older copy rather than keep a stale one.
            this.refused++;
            try {
                this.storage.removeItem(key);
            } catch {
                // Nothing more to do.
            }
            return false;
        }
    }

    lists(kind: CatalogKind): Kept<XtreamCategory[]> | null {
        const kept = this.read(LISTS + kind);
        if (!kept || !Array.isArray(kept.value)) {
            return null;
        }
        const list = (kept.value as unknown[])
            .filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2)
            .map(([category_id, category_name]) => ({ category_id, category_name: String(category_name) }));
        return { at: kept.at, value: list };
    }

    saveLists(kind: CatalogKind, list: readonly XtreamCategory[]): void {
        this.write(
            LISTS + kind,
            list.map((category) => [String(category.category_id), category.category_name])
        );
    }

    items(kind: PlatformTitleKind, categoryId: string): Kept<RawItem[]> | null {
        const kept = this.read(`${ITEMS}${kind}:${categoryId}`);
        if (!kept || !Array.isArray(kept.value)) {
            return null;
        }
        return { at: kept.at, value: (kept.value as Record<string, unknown>[]).map((entry) => unpack(entry, kind)) };
    }

    /**
     * Keeps `items` (newest first) in at most `share` characters: the
     * oldest titles go first when the category is too big for it.
     */
    saveItems(kind: PlatformTitleKind, categoryId: string, items: readonly RawItem[], categories: number): boolean {
        const share = Math.min(SHARE_MAX, Math.floor(CATALOG_BUDGET / Math.max(1, categories)));
        let packed = items.map((item) => pack(item, kind));
        let size = JSON.stringify(packed).length;
        while (size > share && packed.length > 10) {
            packed = packed.slice(0, Math.floor((packed.length * share) / size * 0.95));
            size = JSON.stringify(packed).length;
        }
        return this.write(`${ITEMS}${kind}:${categoryId}`, packed);
    }

    /** Forgets every kept copy (Diagnóstico → Reintentar keeps them). */
    clear(): void {
        for (const key of storageKeys(this.storage)) {
            if (key.indexOf(ITEMS) === 0 || key.indexOf(LISTS) === 0) {
                this.storage?.removeItem(key);
            }
        }
    }
}

function storageKeys(storage: StorageLike | null): string[] {
    const keys: string[] = [];
    const source = storage as (StorageLike & { length?: number; key?: (index: number) => string | null }) | null;
    try {
        const count = source && typeof source.length === 'number' ? source.length : 0;
        for (let i = 0; i < count; i++) {
            const key = source && source.key ? source.key(i) : null;
            if (key !== null) {
                keys.push(key);
            }
        }
    } catch {
        // A storage that cannot be listed counts as empty.
    }
    return keys;
}

export interface StorageUse {
    /** Characters held (keys and values); a TV stores each in two bytes. */
    readonly chars: number;
    readonly catalogChars: number;
    readonly keys: number;
}

/** What this origin's localStorage holds now, for Diagnóstico. */
export function storageUse(storage: StorageLike | null = defaultStorage()): StorageUse {
    let chars = 0;
    let catalogChars = 0;
    const keys = storageKeys(storage);
    for (const key of keys) {
        let value = '';
        try {
            value = (storage && storage.getItem(key)) || '';
        } catch {
            value = '';
        }
        const size = key.length + value.length;
        chars += size;
        if (key.indexOf(ITEMS) === 0 || key.indexOf(LISTS) === 0) {
            catalogChars += size;
        }
    }
    return { chars, catalogChars, keys: keys.length };
}
