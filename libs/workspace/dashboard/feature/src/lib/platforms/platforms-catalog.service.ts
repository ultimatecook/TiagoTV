import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { buildXtreamNavigationTarget } from '@iptvnator/portal/shared/util';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import { primaryXtreamSource, xtreamSourceCredentials } from '../xtream-source';
import type { PlatformGenre } from './platform-genres';
import {
    mergePlatformTitles,
    toPlatformTitles,
    type PlatformTitle,
} from './platform-titles';
import {
    buildGenreCategories,
    buildPlatformShelves,
    type PlatformShelf,
    type StreamingPlatformId,
} from './streaming-platforms';

/** Category lists change with the provider's line-up, not by the minute. */
const FRESH_MS = 30 * 60 * 1000;
const OPTIONS = { suppressErrorLog: true };

interface Loaded<T> {
    readonly playlistId: string;
    readonly value: T;
    readonly at: number;
}

interface PlatformCatalog {
    readonly shelves: readonly PlatformShelf[];
    readonly genreCategories: ReadonlyMap<string, readonly PlatformGenre[]>;
}

/**
 * The platforms of the Xtream source: which ones it carries (from its VOD
 * and series categories) and, per platform, its titles, loaded when its
 * page opens.
 */
@Injectable({ providedIn: 'root' })
export class PlatformsCatalogService {
    private readonly api = inject(XtreamApiService);
    private readonly router = inject(Router);
    private readonly playlists = inject(Store).selectSignal(
        selectAllPlaylistsMeta
    );
    private readonly loadedCatalog = signal<Loaded<PlatformCatalog> | null>(
        null
    );
    private readonly loadedTitles = signal<
        ReadonlyMap<StreamingPlatformId, Loaded<readonly PlatformTitle[]>>
    >(new Map());
    private catalogRequest: Promise<void> | null = null;
    private readonly titleRequests = new Map<
        StreamingPlatformId,
        Promise<void>
    >();

    readonly source = computed(() => primaryXtreamSource(this.playlists()));
    private readonly catalog = computed(() => {
        const loaded = this.loadedCatalog();
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.value
            : null;
    });
    readonly shelves = computed(() => this.catalog()?.shelves ?? null);
    readonly failed = signal(false);

    /** The platform's titles, newest first, once loaded. */
    titlesOf(id: StreamingPlatformId): readonly PlatformTitle[] | null {
        const loaded = this.loadedTitles().get(id);
        return loaded && loaded.playlistId === this.source()?._id
            ? loaded.value
            : null;
    }

    loadShelves(): Promise<void> {
        const source = this.source();
        if (!source || isFresh(this.loadedCatalog(), source._id)) {
            return Promise.resolve();
        }
        const credentials = xtreamSourceCredentials(source);
        this.catalogRequest ??= Promise.all([
            this.api.getCategories(credentials, 'vod', OPTIONS),
            this.api.getCategories(credentials, 'series', OPTIONS),
        ])
            .then(([vod, series]) => {
                this.failed.set(false);
                this.loadedCatalog.set({
                    playlistId: source._id,
                    value: {
                        shelves: buildPlatformShelves(vod, series),
                        genreCategories: buildGenreCategories([
                            ...vod,
                            ...series,
                        ]),
                    },
                    at: Date.now(),
                });
            })
            .catch(() => this.failed.set(true))
            .finally(() => (this.catalogRequest = null));
        return this.catalogRequest;
    }

    async loadTitles(id: StreamingPlatformId): Promise<void> {
        await this.loadShelves();
        const source = this.source();
        const catalog = this.catalog();
        const shelf = catalog?.shelves.find((item) => item.platform.id === id);
        if (
            !source ||
            !catalog ||
            !shelf ||
            isFresh(this.loadedTitles().get(id) ?? null, source._id)
        ) {
            return;
        }
        let request = this.titleRequests.get(id);
        if (!request) {
            const credentials = xtreamSourceCredentials(source);
            const options = (categoryId: string) => ({
                ...OPTIONS,
                categoryId,
            });
            request = Promise.all(
                shelf.categories.map(async (category) =>
                    toPlatformTitles(
                        category,
                        category.kind === 'movie'
                            ? await this.api.getVodStreams(
                                  credentials,
                                  options(category.id)
                              )
                            : await this.api.getSeriesStreams(
                                  credentials,
                                  options(category.id)
                              ),
                        catalog.genreCategories
                    )
                )
            )
                .then((lists) => {
                    this.failed.set(false);
                    this.loadedTitles.update((state) =>
                        new Map(state).set(id, {
                            playlistId: source._id,
                            value: mergePlatformTitles(lists),
                            at: Date.now(),
                        })
                    );
                })
                .catch(() => this.failed.set(true))
                .finally(() => this.titleRequests.delete(id));
            this.titleRequests.set(id, request);
        }
        return request;
    }

    /** Opens the title's page, as the catalog's own grid does. */
    open(title: PlatformTitle): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const target = buildXtreamNavigationTarget({
            playlistId: source._id,
            type: title.kind,
            categoryId: title.categoryId,
            itemId: title.id,
            title: title.title,
            imageUrl: title.poster,
        });
        void this.router.navigate(target.link, { state: target.state });
    }
}

function isFresh(loaded: Loaded<unknown> | null, playlistId: string): boolean {
    return (
        loaded?.playlistId === playlistId && Date.now() - loaded.at < FRESH_MS
    );
}
