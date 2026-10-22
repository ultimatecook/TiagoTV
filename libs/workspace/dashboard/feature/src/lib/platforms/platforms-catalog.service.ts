import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import {
    buildXtreamNavigationTarget,
    withDetailPlayRequest,
    type DetailPlayMode,
} from '@iptvnator/portal/shared/util';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import { CatalogRequestLog } from '../catalog/catalog-request-log';
import { primaryXtreamSource, xtreamSourceCredentials } from '../xtream-source';
import type { PlatformGenre } from './platform-genres';
import { titleExtras, type PlatformTitleExtras } from './platform-hero';
import {
    toPlatformTitles,
    type PlatformTitle,
    type PlatformTitleVersion,
} from './platform-titles';
import {
    buildGenreCategories,
    buildPlatformShelves,
    type PlatformCatalogCategory,
    type PlatformCategory,
    type PlatformShelf,
} from './streaming-platforms';

/** Category lists change with the provider's line-up, not by the minute. */
const FRESH_MS = 30 * 60 * 1000;
const OPTIONS = { suppressErrorLog: true };
/**
 * The last category lists that loaded, per playlist: a busy provider (it
 * refuses requests while the app imports its catalog) must not make the
 * platforms vanish until the next visit.
 */
const STORAGE_KEY = 'tiagotv:platform-categories:v1';
/** After a failed load, one more try this soon. */
const RETRY_MS = 20_000;

interface StoredCategories {
    readonly playlistId: string;
    readonly vod: readonly PlatformCatalogCategory[];
    readonly series: readonly PlatformCatalogCategory[];
}

interface Loaded<T> {
    readonly playlistId: string;
    readonly value: T;
    readonly at: number;
}

interface PlatformCatalog {
    readonly shelves: readonly PlatformShelf[];
    readonly genreCategories: ReadonlyMap<string, readonly PlatformGenre[]>;
    /** "movie:1535" → "✪ ORIGINAL AMAZON  MULTI". */
    readonly names: ReadonlyMap<string, string>;
}

/**
 * The platforms of the Xtream source: which ones it carries (from its VOD
 * and series categories), one category's list on request, and the hero
 * titles' pages. The platforms' lists themselves are kept by
 * `CatalogPlatformLists`, which Series, Películas, Buscar and the platform
 * pages share.
 */
@Injectable({ providedIn: 'root' })
export class PlatformsCatalogService {
    private readonly api = inject(XtreamApiService);
    private readonly log = inject(CatalogRequestLog);
    private readonly router = inject(Router);
    private readonly playlists = inject(Store).selectSignal(
        selectAllPlaylistsMeta
    );
    private readonly loadedCatalog = signal<Loaded<PlatformCatalog> | null>(
        null
    );
    private readonly loadedExtras = signal<
        ReadonlyMap<string, PlatformTitleExtras>
    >(new Map());
    private readonly extrasRequested = new Set<string>();
    private catalogRequest: Promise<void> | null = null;
    private retry: ReturnType<typeof setTimeout> | null = null;

    readonly source = computed(() => primaryXtreamSource(this.playlists()));
    private readonly catalog = computed(() => {
        const loaded = this.loadedCatalog();
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.value
            : null;
    });
    readonly shelves = computed(() => this.catalog()?.shelves ?? null);
    readonly failed = signal(false);

    /** A platform category's name, as the provider calls it. */
    categoryName(category: PlatformCategory): string | null {
        return (
            this.catalog()?.names.get(`${category.kind}:${category.id}`) ?? null
        );
    }

    loadShelves(): Promise<void> {
        const source = this.source();
        if (!source || isFresh(this.loadedCatalog(), source._id)) {
            return Promise.resolve();
        }
        if (this.loadedCatalog()?.playlistId !== source._id) {
            // The last lists that loaded show at once (stale: reloaded now).
            const stored = readStored(source._id);
            if (stored) {
                this.loadedCatalog.set({
                    playlistId: source._id,
                    value: toCatalog(stored.vod, stored.series),
                    at: 0,
                });
            }
        }
        const credentials = xtreamSourceCredentials(source);
        // One after the other: the provider refuses bursts.
        const ask = (type: 'vod' | 'series') =>
            this.log.track(`get_${type}_categories`, null, () =>
                this.api.getCategories(credentials, type, OPTIONS)
            );
        this.catalogRequest ??= ask('vod')
            .then(async (vod) => [vod, await ask('series')] as const)
            .then(([vod, series]) => {
                this.failed.set(false);
                this.loadedCatalog.set({
                    playlistId: source._id,
                    value: toCatalog(vod, series),
                    at: Date.now(),
                });
                writeStored({ playlistId: source._id, vod, series });
            })
            .catch(() => {
                this.failed.set(true);
                this.retry ??= setTimeout(() => {
                    this.retry = null;
                    void this.loadShelves();
                }, RETRY_MS);
            })
            .finally(() => (this.catalogRequest = null));
        return this.catalogRequest;
    }

    /**
     * One of the platforms' categories, asked now (one request); its
     * caller (`CatalogPlatformLists`) keeps it and queues the requests.
     */
    async categoryTitles(
        category: PlatformCategory
    ): Promise<PlatformTitle[]> {
        const source = this.source();
        if (!source) {
            return [];
        }
        const credentials = xtreamSourceCredentials(source);
        const options = { ...OPTIONS, categoryId: category.id };
        const items =
            category.kind === 'movie'
                ? await this.api.getVodStreams(credentials, options)
                : await this.api.getSeriesStreams(credentials, options);
        return toPlatformTitles(
            category,
            items,
            this.catalog()?.genreCategories
        );
    }

    /** The synopsis and backdrop of a hero title, once fetched. */
    extrasOf(title: PlatformTitle): PlatformTitleExtras | null {
        const source = this.source();
        return source
            ? (this.loadedExtras().get(extrasKey(source._id, title)) ?? null)
            : null;
    }

    /**
     * Fetches the hero titles' own pages for their synopsis and backdrop
     * (a movie list carries neither), once per title.
     */
    loadExtras(titles: readonly PlatformTitle[]): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const credentials = xtreamSourceCredentials(source);
        for (const title of titles) {
            const key = extrasKey(source._id, title);
            if (this.extrasRequested.has(key)) {
                continue;
            }
            this.extrasRequested.add(key);
            const details =
                title.kind === 'movie'
                    ? this.log.track('get_vod_info', null, () =>
                          this.api.getVodInfo(credentials, title.id, OPTIONS)
                      )
                    : this.log.track('get_series_info', null, () =>
                          this.api.getSeriesInfo(credentials, title.id, OPTIONS)
                      );
            void details
                .then((answer) =>
                    this.loadedExtras.update((state) =>
                        new Map(state).set(key, titleExtras(answer?.info))
                    )
                )
                .catch(() => undefined);
        }
    }

    /**
     * Opens the title's page, as the catalog's own grid does: its first
     * version's (Spanish where there is one), or the version asked for.
     */
    open(
        title: PlatformTitle,
        version: PlatformTitleVersion = title.versions[0] ?? title,
        play?: DetailPlayMode
    ): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const target = buildXtreamNavigationTarget({
            playlistId: source._id,
            type: title.kind,
            categoryId: version.categoryId,
            itemId: version.id,
            title: version.title,
            imageUrl: title.poster,
        });
        const navigation = play
            ? withDetailPlayRequest(target, {
                  mode: play,
                  contentId: version.id,
              })
            : target;
        void this.router.navigate(navigation.link, {
            state: navigation.state,
        });
    }

    /**
     * Opens the title's page playing it (see `DetailPlayMode`): a "play"
     * button that does not stop at the page.
     */
    play(title: PlatformTitle, mode: DetailPlayMode): void {
        this.open(title, undefined, mode);
    }
}

function extrasKey(playlistId: string, title: PlatformTitle): string {
    return `${playlistId}:${title.kind}:${title.id}`;
}

function isFresh(loaded: Loaded<unknown> | null, playlistId: string): boolean {
    return (
        loaded?.playlistId === playlistId && Date.now() - loaded.at < FRESH_MS
    );
}

function toCatalog(
    vod: readonly PlatformCatalogCategory[],
    series: readonly PlatformCatalogCategory[]
): PlatformCatalog {
    const names = new Map<string, string>();
    for (const [kind, categories] of [
        ['movie', vod],
        ['series', series],
    ] as const) {
        for (const category of categories) {
            names.set(`${kind}:${category.category_id}`, category.category_name);
        }
    }
    return {
        shelves: buildPlatformShelves(vod, series),
        genreCategories: buildGenreCategories([...vod, ...series]),
        names,
    };
}

const onlyNames = (categories: readonly PlatformCatalogCategory[]) =>
    categories.map(({ category_id, category_name }) => ({
        category_id,
        category_name,
    }));

function readStored(playlistId: string): StoredCategories | null {
    try {
        const stored = JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? 'null'
        ) as StoredCategories | null;
        return stored?.playlistId === playlistId &&
            Array.isArray(stored.vod) &&
            Array.isArray(stored.series)
            ? stored
            : null;
    } catch {
        return null;
    }
}

function writeStored(stored: StoredCategories): void {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                playlistId: stored.playlistId,
                vod: onlyNames(stored.vod),
                series: onlyNames(stored.series),
            })
        );
    } catch {
        // A full or blocked storage only costs the head start.
    }
}
