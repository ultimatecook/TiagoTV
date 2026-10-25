import {
    aggregateCatalog,
    buildGenreCategories,
    buildPlatformShelves,
    mergePlatformTitles,
    toPlatformTitles,
    type CatalogTitle,
    type PlatformCategory,
    type PlatformGenre,
    type PlatformShelf,
    type PlatformTitle,
    type PlatformTitleKind,
    type PlatformTitleList,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { resultLabel } from '../core/http';
import { PREFETCH, VIEWER, type Priority, type Queued } from '../core/request-queue';
import type { CatalogCache } from './catalog-cache';
import { compact, newest, type RawItem } from './catalog-items';
import { loadOrder, type OrderedCategory } from './catalog-order';
import { REFRESH_MS, type CatalogPersist } from './catalog-persist';
import { Backdrops } from './backdrops';

/**
 * The streaming platforms' catalog, as the desktop's Series / Películas,
 * platform pages and Home picks read it: the provider's platform
 * categories ("|ES| ✪ ORIGINAL NETFLIX", "✪ ORIGINAL AMAZON  MULTI";
 * buildPlatformShelves), one title per show across languages and
 * platforms (aggregateCatalog, mergePlatformTitles).
 *
 * Each category is cut to its newest titles and the fields the cards read
 * (catalog-items.ts) and kept across launches (catalog-persist.ts): the
 * kept copies show at once, and one older than REFRESH_MS is asked again
 * in the background. Categories load in catalog-order.ts's order through
 * the request queue; one that fails is tried once more after the others,
 * and its error stays for the pages (and Diagnóstico) to show.
 */
export type CategoryState = 'waiting' | 'ok' | 'kept' | 'failed';

export interface CategoryStatus {
    readonly kind: PlatformTitleKind;
    readonly name: string;
    readonly state: CategoryState;
    readonly titles: number;
    /** The last failure's short result ("timeout", "http 500"), if any. */
    readonly error: string | null;
}

interface Loaded {
    readonly platform: StreamingPlatform;
    readonly category: PlatformCategory;
    readonly titles: readonly PlatformTitle[];
    readonly at: number;
}

export interface Shelves {
    readonly shelves: readonly PlatformShelf[];
    readonly genres: Readonly<Record<PlatformTitleKind, ReadonlyMap<string, readonly PlatformGenre[]>>>;
}

export type CatalogListener = () => void;

export class CatalogStore {
    /** A movie's file type by stream id (`mkv`, `mp4`), for its URL. */
    readonly extensions = new Map<number, string>();
    private readonly loaded = new Map<string, Loaded>();
    private readonly pending = new Map<string, Queued<Loaded | null>>();
    private readonly status = new Map<string, CategoryStatus>();
    private readonly errors = new Map<string, unknown>();
    private shelvesPromise: Promise<Shelves> | null = null;
    private readonly listeners: CatalogListener[] = [];
    private version = 0;
    private memo = new Map<string, { version: number; value: unknown }>();
    private readonly backdrops: Backdrops;

    constructor(
        private readonly cache: CatalogCache,
        private readonly persist: CatalogPersist
    ) {
        this.backdrops = new Backdrops(cache.client, () => this.changed());
    }

    /** Runs `listener` whenever a category arrives (or fails). */
    onChange(listener: CatalogListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        };
    }

    shelves(): Promise<Shelves> {
        if (!this.shelvesPromise) {
            this.shelvesPromise = Promise.all([this.cache.categories('vod'), this.cache.categories('series')]).then(
                ([vod, series]) => {
                    const shelves: Shelves = {
                        shelves: buildPlatformShelves(vod, series),
                        genres: { movie: buildGenreCategories(vod), series: buildGenreCategories(series) },
                    };
                    this.restore(shelves);
                    return shelves;
                },
                (error) => {
                    this.shelvesPromise = null;
                    throw error;
                }
            );
        }
        return this.shelvesPromise;
    }

    private key(category: PlatformCategory): string {
        return `${category.kind}:${category.id}`;
    }

    private categoryCount(shelves: Shelves): number {
        return shelves.shelves.reduce((count, shelf) => count + shelf.categories.length, 0);
    }

    /** The kept copies, shown before anything is asked. */
    private restore(shelves: Shelves): void {
        let restored = 0;
        for (const shelf of shelves.shelves) {
            for (const category of shelf.categories) {
                const kept = this.persist.items(category.kind, category.id);
                if (kept) {
                    this.accept({ platform: shelf.platform, category }, kept.value, shelves.genres[category.kind], kept.at);
                    this.setStatus({ platform: shelf.platform, category }, 'kept', null);
                    restored++;
                } else {
                    this.setStatus({ platform: shelf.platform, category }, 'waiting', null);
                }
            }
        }
        if (restored > 0) {
            this.changed();
        }
    }

    private setStatus(entry: OrderedCategory, state: CategoryState, error: unknown): void {
        const { platform, category } = entry;
        const key = this.key(category);
        if (error) {
            this.errors.set(key, error);
        }
        this.status.set(key, {
            kind: category.kind,
            name: `${platform.name} ${category.language}`,
            state,
            titles: this.loaded.get(key)?.titles.length ?? 0,
            error: error ? resultLabel(error) : null,
        });
    }

    private accept(entry: OrderedCategory, items: readonly RawItem[], genres: ReadonlyMap<string, readonly PlatformGenre[]>, at: number): Loaded {
        const { platform, category } = entry;
        if (category.kind === 'movie') {
            for (const item of items) {
                const id = Number(item.stream_id);
                if (Number.isFinite(id) && item.container_extension) {
                    this.extensions.set(id, String(item.container_extension));
                }
            }
        }
        const loaded = { platform, category, titles: toPlatformTitles(category, items, genres), at };
        this.loaded.set(this.key(category), loaded);
        return loaded;
    }

    private fetch(entry: OrderedCategory, shelves: Shelves, priority: Priority): Promise<Loaded | null> {
        const { category } = entry;
        const key = this.key(category);
        const running = this.pending.get(key);
        if (running) {
            running.promote(priority);
            return running.promise;
        }
        const request = this.cache.client.streamsRequest<RawItem>(category.kind === 'movie' ? 'vod' : 'series', category.id, priority);
        const promise = request.promise.then(
            (items) => {
                const kept = newest(items, category.kind).map(compact);
                const loaded = this.accept(entry, kept, shelves.genres[category.kind], Date.now());
                this.persist.saveItems(category.kind, category.id, kept, this.categoryCount(shelves));
                this.errors.delete(key);
                this.setStatus(entry, 'ok', null);
                this.pending.delete(key);
                this.changed();
                return loaded;
            },
            (error) => {
                this.pending.delete(key);
                this.setStatus(entry, this.loaded.has(key) ? 'kept' : 'failed', error);
                this.changed();
                return null;
            }
        );
        this.pending.set(key, { promise, promote: request.promote });
        return promise;
    }

    /** Whether `key` needs asking: not here, failed, or past its time. */
    private due(key: string, now: number): boolean {
        const entry = this.loaded.get(key);
        return !entry || now - entry.at > REFRESH_MS || this.status.get(key)?.state === 'failed';
    }

    /** A title list is past its time (the TV can stay on for days). */
    refreshDue(now = Date.now()): boolean {
        let due = false;
        this.loaded.forEach((entry) => {
            due = due || now - entry.at > REFRESH_MS;
        });
        return due;
    }

    private changed(): void {
        this.version++;
        for (const listener of this.listeners.slice()) {
            listener();
        }
    }

    /**
     * Loads the categories of `kinds` (every platform's, or `platformId`'s)
     * in catalog-order's order; resolves when all have settled, a failed
     * one tried once more after the others. A kept copy past its time is
     * asked again in the background, whoever asks.
     */
    async load(kinds: readonly PlatformTitleKind[], platformId?: string, priority: Priority = VIEWER): Promise<void> {
        const shelves = await this.shelves();
        const now = Date.now();
        const order = loadOrder(shelves.shelves, kinds, platformId).filter(({ category }) => this.due(this.key(category), now));
        const run = (list: readonly OrderedCategory[]) =>
            Promise.all(
                list.map((entry) => {
                    const stale = this.loaded.has(this.key(entry.category));
                    return this.fetch(entry, shelves, stale ? PREFETCH : priority);
                })
            );
        const results = await run(order);
        const failed = order.filter((_, index) => results[index] === null);
        if (failed.length > 0) {
            await run(failed);
        }
    }

    /** Every category of `kinds` with its titles here, or failed (after its retry). */
    async settled(kinds: readonly PlatformTitleKind[]): Promise<boolean> {
        const { shelves } = await this.shelves();
        return shelves.every((shelf) =>
            shelf.categories.every((category) => {
                const key = this.key(category);
                return kinds.indexOf(category.kind) < 0 || (!this.pending.has(key) && (this.loaded.has(key) || this.status.get(key)?.state === 'failed'));
            })
        );
    }

    /** The first error of a category of `kind` that has no titles, if any. */
    errorOf(kind: PlatformTitleKind): unknown {
        let found: unknown = null;
        this.status.forEach((status, key) => {
            if (!found && status.kind === kind && status.state === 'failed') {
                found = this.errors.get(key) ?? null;
            }
        });
        return found;
    }

    /** Every category's state, for Diagnóstico. */
    statuses(): CategoryStatus[] {
        const list: CategoryStatus[] = [];
        this.status.forEach((status) => list.push(status));
        return list;
    }

    /** Asks the failed categories again (Diagnóstico → Reintentar cargas). */
    retryFailed(): Promise<void> {
        return this.load(['movie', 'series'], undefined, PREFETCH);
    }

    private remember<T>(key: string, build: () => T): T {
        const entry = this.memo.get(key);
        if (entry && entry.version === this.version) {
            return entry.value as T;
        }
        const value = build();
        this.memo.set(key, { version: this.version, value });
        return value;
    }

    /** Series / Películas: every platform's titles of `kind` loaded so far. */
    titles(kind: PlatformTitleKind): CatalogTitle[] {
        return this.remember(`catalog:${kind}`, () => {
            const lists: PlatformTitleList[] = [];
            this.loaded.forEach((entry) => {
                if (entry.category.kind === kind) {
                    lists.push({ platform: entry.platform, titles: entry.titles });
                }
            });
            return aggregateCatalog(lists, kind);
        });
    }

    /** A platform's page: its movies and series, one per show, newest first. */
    platformTitles(platformId: string): PlatformTitle[] {
        return this.remember(`platform:${platformId}`, () => {
            const lists: PlatformTitle[][] = [];
            this.loaded.forEach((entry) => {
                if (entry.platform.id === platformId) {
                    lists.push(entry.titles.slice());
                }
            });
            return mergePlatformTitles(lists);
        });
    }

    /** A title's backdrop: its list's, or the one its page gave. */
    backdropOf(title: PlatformTitle): string | null {
        return this.backdrops.of(title);
    }

    /** Asks the pages of a hero's few titles without a backdrop for one. */
    probeBackdrops(titles: readonly PlatformTitle[], limit = 6): Promise<void> {
        return this.backdrops.probe(titles, limit);
    }

    /** The platform whose category files `title`, if loaded. */
    platformOf(title: PlatformTitle): StreamingPlatform | null {
        const entry = this.loaded.get(`${title.kind}:${title.categoryId}`);
        return entry ? entry.platform : null;
    }
}
