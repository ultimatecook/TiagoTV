import {
    aggregateCatalog,
    buildGenreCategories,
    buildPlatformShelves,
    mergePlatformTitles,
    toPlatformTitles,
    type CatalogTitle,
    type PlatformCatalogItem,
    type PlatformCategory,
    type PlatformGenre,
    type PlatformShelf,
    type PlatformTitle,
    type PlatformTitleKind,
    type PlatformTitleList,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { CatalogCache } from './catalog-cache';
import { parseSeriesInfo, parseVodInfo } from './details';

/**
 * The streaming platforms' catalog, as the desktop's Series / Películas,
 * platform pages and Home picks read it: the provider's platform
 * categories ("|ES| ✪ ORIGINAL NETFLIX", "✪ ORIGINAL AMAZON  MULTI";
 * buildPlatformShelves), one title per show across languages and
 * platforms (aggregateCatalog, mergePlatformTitles).
 *
 * Categories load one at a time (the request queue), each cut to its
 * newest CATEGORY_LIMIT titles and to the fields the cards read, and stay
 * in memory for the session: a 2019 TV must not hold whole catalogs.
 */
export const CATEGORY_LIMIT = 250;

interface RawItem extends PlatformCatalogItem {
    readonly container_extension?: string;
}

interface Loaded {
    readonly platform: StreamingPlatform;
    readonly category: PlatformCategory;
    readonly titles: readonly PlatformTitle[];
}

export interface Shelves {
    readonly shelves: readonly PlatformShelf[];
    readonly genres: Readonly<Record<PlatformTitleKind, ReadonlyMap<string, readonly PlatformGenre[]>>>;
}

/** Newest first, by the field each kind dates itself with. */
function newest(items: readonly RawItem[], kind: PlatformTitleKind): RawItem[] {
    const date = (item: RawItem) => Number(kind === 'movie' ? item.added : item.last_modified) || 0;
    return items
        .slice()
        .sort((a, b) => date(b) - date(a))
        .slice(0, CATEGORY_LIMIT);
}

function compact(item: RawItem): PlatformCatalogItem {
    return {
        stream_id: item.stream_id,
        series_id: item.series_id,
        name: item.name,
        stream_icon: item.stream_icon,
        cover: item.cover,
        added: item.added,
        last_modified: item.last_modified,
        genre: item.genre,
        category_ids: item.category_ids,
        rating: item.rating,
        plot: item.plot,
        backdrop_path: item.backdrop_path,
        tmdb: item.tmdb,
        tmdb_id: item.tmdb_id,
        year: item.year,
        releaseDate: item.releaseDate,
        release_date: item.release_date,
    };
}

export type CatalogListener = () => void;

export class CatalogStore {
    /** A movie's file type by stream id (`mkv`, `mp4`), for its URL. */
    readonly extensions = new Map<number, string>();
    private readonly loaded = new Map<string, Loaded>();
    private readonly pending = new Map<string, Promise<Loaded | null>>();
    private shelvesPromise: Promise<Shelves> | null = null;
    private readonly listeners: CatalogListener[] = [];
    private version = 0;
    private memo = new Map<string, { version: number; value: unknown }>();
    /** Backdrops found on titles' own pages (lists give movies none). */
    private readonly backdrops = new Map<string, string | null>();
    failed = 0;

    constructor(private readonly cache: CatalogCache) {}

    /** Runs `listener` whenever a category arrives. */
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
            this.shelvesPromise = Promise.all([
                this.cache.categories('vod'),
                this.cache.categories('series'),
            ]).then(
                ([vod, series]) => ({
                    shelves: buildPlatformShelves(vod, series),
                    genres: { movie: buildGenreCategories(vod), series: buildGenreCategories(series) },
                }),
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

    private async loadCategory(
        platform: StreamingPlatform,
        category: PlatformCategory,
        genres: ReadonlyMap<string, readonly PlatformGenre[]>,
        background: boolean
    ): Promise<Loaded | null> {
        const key = this.key(category);
        const done = this.loaded.get(key);
        if (done) {
            return done;
        }
        let promise = this.pending.get(key);
        if (!promise) {
            promise = this.cache.client
                .streams<RawItem>(category.kind === 'movie' ? 'vod' : 'series', category.id, background)
                .then(
                    (items) => {
                        const kept = newest(items, category.kind);
                        if (category.kind === 'movie') {
                            for (const item of kept) {
                                const id = Number(item.stream_id);
                                if (Number.isFinite(id) && item.container_extension) {
                                    this.extensions.set(id, String(item.container_extension));
                                }
                            }
                        }
                        const entry = {
                            platform,
                            category,
                            titles: toPlatformTitles(category, kept.map(compact), genres),
                        };
                        this.loaded.set(key, entry);
                        this.pending.delete(key);
                        this.changed();
                        return entry;
                    },
                    () => {
                        this.pending.delete(key);
                        this.failed++;
                        return null;
                    }
                );
            this.pending.set(key, promise);
        }
        return promise;
    }

    private changed(): void {
        this.version++;
        for (const listener of this.listeners.slice()) {
            listener();
        }
    }

    /**
     * Loads the categories of `kinds` (all platforms, in their order, or
     * only `platformId`'s), one at a time; resolves when all have settled.
     * In the background, at most one of them waits in the request queue,
     * so the viewer's own requests pass it.
     */
    async load(kinds: readonly PlatformTitleKind[], platformId?: string, background = false): Promise<void> {
        const { shelves, genres } = await this.shelves();
        for (const shelf of shelves) {
            if (platformId && shelf.platform.id !== platformId) {
                continue;
            }
            for (const category of shelf.categories) {
                if (kinds.indexOf(category.kind) >= 0) {
                    await this.loadCategory(shelf.platform, category, genres[category.kind], background);
                }
            }
        }
    }

    /** Whether every category of `kinds` has been asked for and arrived. */
    async complete(kinds: readonly PlatformTitleKind[]): Promise<boolean> {
        const { shelves } = await this.shelves();
        return shelves.every((shelf) =>
            shelf.categories.every(
                (category) => kinds.indexOf(category.kind) < 0 || this.loaded.has(this.key(category))
            )
        );
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
        return title.backdrop ?? this.backdrops.get(`${title.kind}:${title.id}`) ?? null;
    }

    /**
     * Asks the pages of `titles` without a backdrop for one (a hero's few
     * titles, as the desktop does), one at a time in the background.
     */
    async probeBackdrops(titles: readonly PlatformTitle[], limit = 6): Promise<void> {
        const wanted = titles
            .filter((title) => !title.backdrop && !this.backdrops.has(`${title.kind}:${title.id}`))
            .slice(0, limit);
        for (const title of wanted) {
            const key = `${title.kind}:${title.id}`;
            this.backdrops.set(key, null);
            try {
                const info =
                    title.kind === 'movie'
                        ? parseVodInfo(await this.cache.client.vodInfo(title.id, true))
                        : parseSeriesInfo(await this.cache.client.seriesInfo(title.id, true));
                if (info.backdrop) {
                    this.backdrops.set(key, info.backdrop);
                    this.changed();
                }
            } catch {
                // No page: the hero shows the poster.
            }
        }
    }

    /** The platform whose category files `title`, if loaded. */
    platformOf(title: PlatformTitle): StreamingPlatform | null {
        const entry = this.loaded.get(`${title.kind}:${title.categoryId}`);
        return entry ? entry.platform : null;
    }
}
