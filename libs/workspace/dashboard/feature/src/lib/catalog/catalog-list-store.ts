import { Injectable } from '@angular/core';
import type { PlatformGenre } from '../platforms/platform-genres';
import type { PlatformTitle } from '../platforms/platform-titles';
import type {
    PlatformCategory,
    PlatformLanguage,
} from '../platforms/streaming-platforms';
import type { CatalogKind } from './catalog-titles';

const DB_NAME = 'tiagotv-catalog';
const STORE = 'platform-lists';
const DB_VERSION = 1;

/**
 * One title of a platform category's list, as kept across launches: what
 * a card shows. The synopsis is left out (series lists carry long ones);
 * the next refresh brings it back.
 */
export interface CompactTitle {
    readonly i: number;
    readonly t: string;
    readonly p?: string;
    readonly a: number;
    readonly g?: readonly PlatformGenre[];
    readonly r?: number;
    readonly y?: number;
    readonly m?: number;
    readonly b?: string;
}

/** A platform category's list as kept across launches. */
export interface StoredCategoryList {
    readonly playlistId: string;
    readonly kind: CatalogKind;
    readonly categoryId: string;
    readonly language: PlatformLanguage;
    /** When the provider answered it. */
    readonly at: number;
    readonly items: readonly CompactTitle[];
}

interface StoredRecord extends StoredCategoryList {
    readonly key: string;
}

export function toStoredList(
    playlistId: string,
    category: PlatformCategory,
    titles: readonly PlatformTitle[],
    at: number
): StoredCategoryList {
    return {
        playlistId,
        kind: category.kind,
        categoryId: category.id,
        language: category.language,
        at,
        items: titles.map((title) => ({
            i: title.id,
            t: title.title,
            a: title.added,
            ...(title.poster ? { p: title.poster } : {}),
            ...(title.genres.length ? { g: title.genres } : {}),
            ...(title.rating !== null ? { r: title.rating } : {}),
            ...(title.year !== null ? { y: title.year } : {}),
            ...(title.tmdb !== null ? { m: title.tmdb } : {}),
            ...(title.backdrop ? { b: title.backdrop } : {}),
        })),
    };
}

export function fromStoredList(list: StoredCategoryList): PlatformTitle[] {
    return list.items
        .filter((item) => Number.isFinite(item?.i) && !!item.t)
        .map((item) => ({
            id: item.i,
            kind: list.kind,
            categoryId: list.categoryId,
            title: item.t,
            poster: item.p ?? null,
            language: list.language,
            added: Number(item.a) || 0,
            genres: Array.isArray(item.g) ? item.g : [],
            rating: item.r ?? null,
            plot: null,
            backdrop: item.b ?? null,
            tmdb: item.m ?? null,
            year: item.y ?? null,
            versions: [
                {
                    id: item.i,
                    categoryId: list.categoryId,
                    language: list.language,
                    title: item.t,
                },
            ],
        }));
}

/**
 * The platforms' lists kept across launches, in IndexedDB (one record per
 * category; a few MB in all, too much for localStorage), so Series,
 * Películas, Buscar and the platform pages show them at once on the next
 * launch while a refresh runs. Where IndexedDB is unavailable or fails,
 * nothing is kept: the lists are asked again.
 */
@Injectable({ providedIn: 'root' })
export class CatalogListStore {
    private db: Promise<IDBDatabase | null> | null = null;

    async read(playlistId: string): Promise<StoredCategoryList[]> {
        const db = await this.open();
        if (!db) {
            return [];
        }
        try {
            const range = IDBKeyRange.bound(
                `${playlistId}|`,
                `${playlistId}|￿`
            );
            const records = await request<StoredRecord[]>(
                db.transaction(STORE).objectStore(STORE).getAll(range)
            );
            return records.filter(
                (record) =>
                    record?.playlistId === playlistId &&
                    Array.isArray(record.items)
            );
        } catch {
            return [];
        }
    }

    async write(list: StoredCategoryList): Promise<void> {
        const db = await this.open();
        if (!db) {
            return;
        }
        const record: StoredRecord = {
            ...list,
            key: `${list.playlistId}|${list.kind}:${list.categoryId}`,
        };
        try {
            const transaction = db.transaction(STORE, 'readwrite');
            transaction.objectStore(STORE).put(record);
            await done(transaction);
        } catch {
            // A full or blocked store only costs the next launch a refresh.
        }
    }

    async clear(): Promise<void> {
        const db = await this.open();
        if (!db) {
            return;
        }
        try {
            const transaction = db.transaction(STORE, 'readwrite');
            transaction.objectStore(STORE).clear();
            await done(transaction);
        } catch {
            // Nothing kept is nothing to clear.
        }
    }

    private open(): Promise<IDBDatabase | null> {
        this.db ??= new Promise<IDBDatabase | null>((resolve) => {
            try {
                if (typeof indexedDB === 'undefined') {
                    resolve(null);
                    return;
                }
                const opening = indexedDB.open(DB_NAME, DB_VERSION);
                opening.onupgradeneeded = () => {
                    if (!opening.result.objectStoreNames.contains(STORE)) {
                        opening.result.createObjectStore(STORE, {
                            keyPath: 'key',
                        });
                    }
                };
                opening.onsuccess = () => resolve(opening.result);
                opening.onerror = () => resolve(null);
                opening.onblocked = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
        return this.db;
    }
}

function request<T>(req: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
    });
}

function done(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}
