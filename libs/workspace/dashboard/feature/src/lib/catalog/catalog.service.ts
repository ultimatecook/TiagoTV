import { computed, inject, Injectable, signal } from '@angular/core';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { xtreamSourceCredentials } from '../xtream-source';
import { catalogExtras, type CatalogExtras } from './catalog-extras';
import { StoredVodCatalog } from './catalog-stored';
import { storedPlatformLists, withKnownGenres } from './catalog-stored-rows';
import {
    aggregateCatalog,
    type CatalogKind,
    type CatalogTitle,
    type PlatformTitleList,
} from './catalog-titles';

/** The stored copy changes with the app's imports, not by the minute. */
const FRESH_MS = 10 * 60 * 1000;
const OPTIONS = { suppressErrorLog: true };

interface StoredTitles {
    readonly playlistId: string;
    readonly lockVersion: number;
    readonly titles: readonly CatalogTitle[];
    readonly at: number;
}

export type CatalogStatus = 'no-source' | 'loading' | 'ready' | 'failed';

/**
 * Series / Películas: the titles of every platform the source carries,
 * one catalog per kind. Read from the catalog the app already stored
 * (`StoredVodCatalog`), so opening the page asks the provider nothing;
 * where nothing is stored yet, from the platforms' own lists, which
 * `PlatformsCatalogService` loads (one platform after the other) and keeps
 * for the platform pages too. A title's page is asked once, for the hero.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly stored = inject(StoredVodCatalog);
    private readonly api = inject(XtreamApiService);

    private readonly storedTitles = signal<
        ReadonlyMap<CatalogKind, StoredTitles>
    >(new Map());
    /** The kinds read from the platforms' lists: nothing was stored. */
    private readonly fromPlatforms = signal<ReadonlySet<CatalogKind>>(
        new Set()
    );
    private readonly busy = signal<ReadonlySet<CatalogKind>>(new Set());
    private readonly requests = new Map<CatalogKind, Promise<void>>();
    private readonly loadedExtras = signal<ReadonlyMap<string, CatalogExtras>>(
        new Map()
    );
    private readonly extrasRequested = new Set<string>();

    readonly source = this.platforms.source;
    private readonly views = {
        movie: computed(() => this.compute('movie')),
        series: computed(() => this.compute('series')),
    };

    /** The kind's titles, newest first, or null until some are known. */
    titles(kind: CatalogKind): readonly CatalogTitle[] | null {
        return this.views[kind]();
    }

    status(kind: CatalogKind): CatalogStatus {
        if (!this.source()) {
            return 'no-source';
        }
        if (this.titles(kind) !== null) {
            return 'ready';
        }
        return this.busy().has(kind) || !this.platforms.failed()
            ? 'loading'
            : 'failed';
    }

    load(kind: CatalogKind): Promise<void> {
        const source = this.source();
        if (!source || this.isFresh(kind, source._id)) {
            return Promise.resolve();
        }
        let request = this.requests.get(kind);
        if (!request) {
            request = this.read(kind, source).finally(() => {
                this.requests.delete(kind);
                this.busy.update((kinds) => without(kinds, kind));
            });
            this.requests.set(kind, request);
        }
        return request;
    }

    /** The hero title's page, once fetched. */
    extrasOf(title: CatalogTitle): CatalogExtras | null {
        const source = this.source();
        return source
            ? (this.loadedExtras().get(extrasKey(source._id, title)) ?? null)
            : null;
    }

    /** Fetches a hero title's page (backdrop, length), once per title. */
    loadExtras(title: CatalogTitle): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const key = extrasKey(source._id, title);
        if (this.extrasRequested.has(key)) {
            return;
        }
        this.extrasRequested.add(key);
        const credentials = xtreamSourceCredentials(source);
        const details =
            title.kind === 'movie'
                ? this.api.getVodInfo(credentials, title.id, OPTIONS)
                : this.api.getSeriesInfo(credentials, title.id, OPTIONS);
        void details
            .then((answer) =>
                this.loadedExtras.update((state) =>
                    new Map(state).set(key, catalogExtras(answer))
                )
            )
            .catch(() => this.extrasRequested.delete(key));
    }

    /** Opens the title's page, as the platform pages do. */
    open(title: CatalogTitle): void {
        this.platforms.open(title);
    }

    private compute(kind: CatalogKind): readonly CatalogTitle[] | null {
        const source = this.source();
        if (!source) {
            return null;
        }
        const stored = this.storedTitles().get(kind);
        if (stored?.playlistId === source._id) {
            return stored.titles;
        }
        if (!this.fromPlatforms().has(kind)) {
            return null;
        }
        const lists: PlatformTitleList[] = [];
        for (const shelf of this.platforms.shelves() ?? []) {
            const titles = this.platforms.titlesOf(shelf.platform.id);
            if (titles) {
                lists.push({ platform: shelf.platform, titles });
            }
        }
        const titles = aggregateCatalog(lists, kind);
        // None yet: the platforms are still loading, failed, or carry none.
        return titles.length > 0 ||
            (!this.busy().has(kind) && !this.platforms.failed())
            ? titles
            : null;
    }

    private async read(kind: CatalogKind, source: PlaylistMeta): Promise<void> {
        this.busy.update((kinds) => new Set(kinds).add(kind));
        const credentials = xtreamSourceCredentials(source);
        const data = await this.stored
            .read(source._id, credentials, kind)
            .catch(() => null);
        if (data) {
            const lists = withKnownGenres(
                storedPlatformLists(data, kind),
                (list) => this.platforms.titlesOf(list.platform.id)
            );
            const titles = aggregateCatalog(lists, kind);
            if (titles.length > 0) {
                this.storedTitles.update((state) =>
                    new Map(state).set(kind, {
                        playlistId: source._id,
                        lockVersion: this.stored.version(),
                        titles,
                        at: Date.now(),
                    })
                );
                return;
            }
        }
        // Nothing stored: each platform's lists in turn, never all at once.
        this.storedTitles.update((state) => {
            const next = new Map(state);
            next.delete(kind);
            return next;
        });
        this.fromPlatforms.update((kinds) => new Set(kinds).add(kind));
        await this.platforms.loadShelves();
        for (const shelf of this.platforms.shelves() ?? []) {
            if (shelf.categories.some((category) => category.kind === kind)) {
                await this.platforms.loadTitles(shelf.platform.id);
            }
        }
    }

    private isFresh(kind: CatalogKind, playlistId: string): boolean {
        const stored = this.storedTitles().get(kind);
        return (
            stored?.playlistId === playlistId &&
            stored.lockVersion === this.stored.version() &&
            Date.now() - stored.at < FRESH_MS
        );
    }
}

function extrasKey(playlistId: string, title: CatalogTitle): string {
    return `${playlistId}:${title.kind}:${title.id}`;
}

function without<T>(set: ReadonlySet<T>, item: T): ReadonlySet<T> {
    const next = new Set(set);
    next.delete(item);
    return next;
}
