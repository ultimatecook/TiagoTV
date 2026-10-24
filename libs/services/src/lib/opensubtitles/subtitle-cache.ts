import { Injectable } from '@angular/core';

/** A downloaded subtitle as kept across launches (WebVTT text). */
export interface CachedSubtitle {
    readonly key: string;
    readonly name: string;
    /** The OpenSubtitles language code it was filed under. */
    readonly language: string;
    readonly content: string;
    readonly at: number;
}

const DB_NAME = 'tiagotv-subtitles';
const STORE = 'subtitles';
const DB_VERSION = 1;
/** About a season's worth of films and episodes; the oldest go first. */
export const MAX_CACHED_SUBTITLES = 300;

/**
 * Downloaded subtitles per title and language, so watching a title again
 * costs no download from the day's quota. IndexedDB where the runtime has
 * it (the app), memory otherwise (tests); a failed read or write only
 * costs that download.
 */
@Injectable({ providedIn: 'root' })
export class SubtitleCache {
    private readonly memory = new Map<string, CachedSubtitle>();
    private database: Promise<IDBDatabase | null> | null = null;

    async get(key: string): Promise<CachedSubtitle | null> {
        const db = await this.open();
        if (!db) {
            return this.memory.get(key) ?? null;
        }
        return request<CachedSubtitle | undefined>(
            db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
        ).then(
            (entry) => entry ?? null,
            () => null
        );
    }

    async put(entry: CachedSubtitle): Promise<void> {
        const db = await this.open();
        if (!db) {
            this.memory.set(entry.key, entry);
            prune(this.memory);
            return;
        }
        try {
            const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
            await request(store.put(entry));
            // Keys only, oldest first: the texts stay on disk.
            const keys = await request<IDBValidKey[]>(
                store.index('at').getAllKeys()
            );
            const stale = keys.slice(
                0,
                Math.max(0, keys.length - MAX_CACHED_SUBTITLES)
            );
            await Promise.all(stale.map((key) => request(store.delete(key))));
        } catch {
            // A full or blocked storage only costs the next download.
        }
    }

    private open(): Promise<IDBDatabase | null> {
        if (!this.database) {
            this.database = new Promise((resolve) => {
                if (typeof indexedDB === 'undefined') {
                    resolve(null);
                    return;
                }
                try {
                    const opening = indexedDB.open(DB_NAME, DB_VERSION);
                    opening.onupgradeneeded = () => {
                        if (!opening.result.objectStoreNames.contains(STORE)) {
                            opening.result
                                .createObjectStore(STORE, { keyPath: 'key' })
                                .createIndex('at', 'at');
                        }
                    };
                    opening.onsuccess = () => resolve(opening.result);
                    opening.onerror = () => resolve(null);
                    opening.onblocked = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
        }
        return this.database;
    }
}

function request<T = unknown>(req: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
    });
}

function prune(memory: Map<string, CachedSubtitle>): void {
    const stale = [...memory.values()]
        .sort((a, b) => b.at - a.at)
        .slice(MAX_CACHED_SUBTITLES);
    stale.forEach((entry) => memory.delete(entry.key));
}
