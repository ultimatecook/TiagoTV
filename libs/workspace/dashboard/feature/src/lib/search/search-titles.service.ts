import { computed, inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import {
    XTREAM_DATA_SOURCE,
    type XtreamCategoryFromDb,
} from '@iptvnator/portal/xtream/data-access';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import type { XtreamCategory } from '@iptvnator/shared/interfaces';
import { CatalogMembership } from '../catalog/catalog-membership';
import { CatalogPlatformLists } from '../catalog/catalog-platform-lists';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { primaryXtreamSource, xtreamSourceCredentials } from '../xtream-source';
import { listTitleHits, mergeTitleHits } from './search-list-hits';
import {
    catalogQuery,
    toTitleHits,
    type TitleHit,
    type TitleKind,
    type TitleSearchItem,
} from './search-results';

/** The catalog's answers per kind; `null` while it cannot be searched. */
export interface TitleSearch {
    readonly series: readonly TitleHit[] | null;
    readonly movies: readonly TitleHit[] | null;
}

const CATEGORY_TYPE: Record<TitleKind, 'vod' | 'series'> = {
    movie: 'vod',
    series: 'series',
};

/**
 * Series and movies for the search page: the Xtream catalog search the app
 * already has (SQLite in Electron, the session cache in the browser), on
 * the primary source, scoped to the kept languages, together with the
 * platforms' own lists (`CatalogPlatformLists`, kept across launches),
 * which carry the platforms' titles the stored copy may lack. A kind with
 * neither is not searched: nothing here downloads a catalog.
 */
@Injectable()
export class SearchTitlesService {
    private readonly dataSource = inject(XTREAM_DATA_SOURCE);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly membership = inject(CatalogMembership);
    private readonly lists = inject(CatalogPlatformLists);
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly playlists = inject(Store).selectSignal(
        selectAllPlaylistsMeta
    );
    /** Category names per playlist and kind, read once per page. */
    private readonly categoryNames = new Map<
        string,
        Promise<ReadonlyMap<string, string>>
    >();

    readonly source = computed(() => primaryXtreamSource(this.playlists()));

    /**
     * `query` as typed goes to the catalog (its longest word, see
     * `catalogQuery`); `term` (folded) ranks and filters the answers.
     */
    async search(query: string, term: string): Promise<TitleSearch> {
        const [series, movies] = await Promise.all([
            this.searchKind(query, term, 'series'),
            this.searchKind(query, term, 'movie'),
        ]);
        return { series, movies };
    }

    private async searchKind(
        query: string,
        term: string,
        kind: TitleKind
    ): Promise<readonly TitleHit[] | null> {
        const source = this.source();
        if (!source) {
            return null;
        }
        // The last categories known show the platforms at once.
        void this.platforms.loadShelves();
        void this.membership.refresh(kind);
        const [stored, listed] = await Promise.all([
            this.searchStored(source._id, query, term, kind).catch(() => null),
            this.lists.ready().then(() => {
                const lists = this.lists.view(kind).lists;
                return lists.some((list) => list.titles.length > 0)
                    ? listTitleHits(lists, kind, term)
                    : null;
            }),
        ]);
        return stored === null && listed === null
            ? null
            : mergeTitleHits(stored ?? [], listed ?? []);
    }

    /** The stored catalog's answers, or null where it holds none of the kind. */
    private async searchStored(
        playlistId: string,
        query: string,
        term: string,
        kind: TitleKind
    ): Promise<TitleHit[] | null> {
        if (!(await this.dataSource.hasContent(playlistId, kind))) {
            return null;
        }
        const [items, names] = await Promise.all([
            this.dataSource.searchContent(playlistId, catalogQuery(query), [
                kind,
            ]),
            this.namesOf(playlistId, kind),
        ]);
        // The platform that lists the title, wherever its row is stored.
        return toTitleHits(
            items as unknown as TitleSearchItem[],
            kind,
            names,
            term
        ).map((hit) => {
            const platform = this.membership.platformOf(kind, hit.xtreamId);
            return platform ? { ...hit, platform: platform.name } : hit;
        });
    }

    /**
     * The id the kind's items carry in `category_id` → its name: the SQLite
     * row id in Electron, the provider's id in the browser, whose session
     * cache holds the categories its stored content came with.
     */
    private namesOf(
        playlistId: string,
        kind: TitleKind
    ): Promise<ReadonlyMap<string, string>> {
        const key = `${playlistId}:${kind}`;
        let names = this.categoryNames.get(key);
        if (!names) {
            names = this.readCategories(playlistId, kind)
                .then(
                    (categories) =>
                        new Map(
                            categories.map((category) => [
                                categoryKey(category),
                                categoryName(category),
                            ])
                        ) as ReadonlyMap<string, string>
                )
                .catch(() => new Map<string, string>());
            this.categoryNames.set(key, names);
        }
        return names;
    }

    private readCategories(
        playlistId: string,
        kind: TitleKind
    ): Promise<readonly (XtreamCategory | XtreamCategoryFromDb)[]> {
        const type = CATEGORY_TYPE[kind];
        if (this.runtime.supportsXtreamSqliteDataSource) {
            return this.dataSource.getCachedCategories(playlistId, type);
        }
        const source = this.source();
        return source
            ? this.dataSource.getCategories(
                  playlistId,
                  xtreamSourceCredentials(source),
                  type
              )
            : Promise.resolve([]);
    }
}

type AnyCategory = Partial<XtreamCategory> & Partial<XtreamCategoryFromDb>;

function categoryKey(category: AnyCategory): string {
    return String(category.category_id ?? category.id ?? '');
}

function categoryName(category: AnyCategory): string {
    return String(category.category_name ?? category.name ?? '');
}
