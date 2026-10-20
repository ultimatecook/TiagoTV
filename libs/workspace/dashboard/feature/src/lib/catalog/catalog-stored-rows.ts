import type { XtreamCategoryFromDb } from '@iptvnator/portal/xtream/data-access';
import {
    displayTitle,
    type XtreamCategory,
} from '@iptvnator/shared/interfaces';
import type { PlatformGenre } from '../platforms/platform-genres';
import {
    toPlatformTitles,
    type PlatformCatalogItem,
    type PlatformTitle,
} from '../platforms/platform-titles';
import { nameKey } from '../platforms/platform-versions';
import {
    buildGenreCategories,
    buildPlatformShelves,
    type PlatformCatalogCategory,
} from '../platforms/streaming-platforms';
import { categoriesById, type CategoryMembers } from './catalog-members';
import type { CatalogKind, PlatformTitleList } from './catalog-titles';

/**
 * A movie or series row of the app's stored catalog: the SQLite wire shape
 * in Electron (`xtream_id`, `title`, `poster_url`, the category's row id
 * and nothing of genres, years or synopses), the panel's own fields, kept
 * whole by the session cache, in the browser build.
 */
export interface StoredVodRow {
    readonly xtream_id?: number | string;
    readonly stream_id?: number | string;
    readonly series_id?: number | string;
    readonly name?: string;
    readonly title?: string;
    readonly stream_icon?: string | null;
    readonly cover?: string | null;
    readonly poster_url?: string | null;
    readonly category_id?: number | string | null;
    readonly category_ids?: readonly (number | string)[] | null;
    readonly added?: number | string | null;
    readonly last_modified?: string | null;
    readonly genre?: string | null;
    readonly rating?: number | string | null;
    readonly plot?: string | null;
    readonly backdrop_path?: readonly string[] | string | null;
    readonly backdrop_url?: string | null;
    readonly tmdb?: number | string | null;
    readonly tmdb_id?: number | string | null;
    readonly year?: number | string | null;
    readonly releaseDate?: string | null;
    readonly release_date?: string | null;
}

/** The stored catalog of one kind, with the provider's category ids. */
export interface StoredVodCatalogData {
    readonly categories: readonly PlatformCatalogCategory[];
    readonly rows: readonly StoredVodRow[];
}

/** `fromSqlite` rows point at their category's row id, not the provider's. */
export function toStoredVodCatalog(
    categoryRows: readonly (XtreamCategory | XtreamCategoryFromDb)[],
    rows: readonly StoredVodRow[],
    fromSqlite: boolean
): StoredVodCatalogData {
    const providerIdOfRow = new Map<string, string>();
    const categories = categoryRows.map((row): PlatformCatalogCategory => {
        if ('xtream_id' in row) {
            providerIdOfRow.set(String(row.id), String(row.xtream_id));
            return {
                category_id: String(row.xtream_id),
                category_name: row.name,
            };
        }
        return {
            category_id: String(row.category_id),
            category_name: row.category_name,
        };
    });
    return {
        categories,
        rows: fromSqlite
            ? rows.map((row) => ({
                  ...row,
                  category_id:
                      providerIdOfRow.get(String(row.category_id)) ?? null,
              }))
            : rows,
    };
}

/**
 * The platforms' titles of one kind in the stored catalog, one list per
 * platform. A row sits in one category, so the platforms' own lists
 * (`members`) add the platforms that list it elsewhere ("The Boys", stored
 * under "|EN| ✪ SERIES", is on "|EN| ✪ AMAZON-PRIME"). A title its own row
 * names no genre of borrows those of its row's genre category, or of the
 * same-named title in the source's genre categories ("|ES| ✪ COMEDIA").
 */
export function storedPlatformLists(
    data: StoredVodCatalogData,
    kind: CatalogKind,
    members: CategoryMembers = new Map()
): PlatformTitleList[] {
    const shelves = buildPlatformShelves(
        kind === 'movie' ? data.categories : [],
        kind === 'series' ? data.categories : []
    );
    const genreCategories = buildGenreCategories(data.categories);
    const wanted = new Set<string>();
    for (const shelf of shelves) {
        for (const category of shelf.categories) {
            wanted.add(category.id);
        }
    }
    const listedIn = categoriesById(members, wanted);
    const rowsOf = new Map<string, PlatformCatalogItem[]>();
    const named = new Map<string, Set<PlatformGenre>>();
    for (const row of data.rows) {
        const categoryId = String(row.category_id ?? '');
        const homes = new Set(listedIn.get(Number(rowId(row, kind))));
        if (wanted.has(categoryId)) {
            homes.add(categoryId);
        }
        for (const home of homes) {
            const list = rowsOf.get(home) ?? [];
            list.push(toCatalogItem(row, kind));
            rowsOf.set(home, list);
        }
        if (!wanted.has(categoryId)) {
            const genres = genreCategories.get(categoryId);
            const key = genres ? storedNameKey(row) : '';
            if (genres && key) {
                const set = named.get(key) ?? new Set<PlatformGenre>();
                genres.forEach((genre) => set.add(genre));
                named.set(key, set);
            }
        }
    }
    return shelves.map((shelf) => ({
        platform: shelf.platform,
        titles: shelf.categories
            .filter((category) => category.kind === kind)
            .map((category) =>
                toPlatformTitles(
                    category,
                    rowsOf.get(category.id) ?? [],
                    genreCategories
                ).map((title) => withNamedGenres(title, named))
            )
            .reduce<PlatformTitle[]>((all, list) => all.concat(list), []),
    }));
}

/**
 * The genres the platform pages already loaded for the same titles (their
 * lists name them), for the stored titles that name none.
 */
export function withKnownGenres(
    lists: readonly PlatformTitleList[],
    known: (list: PlatformTitleList) => readonly PlatformTitle[] | null
): PlatformTitleList[] {
    return lists.map((list) => {
        const genresOf = new Map<string, readonly PlatformGenre[]>();
        for (const title of known(list) ?? []) {
            for (const version of title.versions) {
                genresOf.set(`${title.kind}:${version.id}`, title.genres);
            }
        }
        if (genresOf.size === 0) {
            return list;
        }
        return {
            platform: list.platform,
            titles: list.titles.map((title) => {
                const genres = genresOf.get(`${title.kind}:${title.id}`);
                return title.genres.length === 0 && genres?.length
                    ? { ...title, genres }
                    : title;
            }),
        };
    });
}

/** "EL HOYO (2019) ES" and "EL HOYO": the same name. */
function storedNameKey(row: StoredVodRow): string {
    const name = row.name ?? row.title ?? '';
    return name ? nameKey(displayTitle(name)) : '';
}

function withNamedGenres(
    title: PlatformTitle,
    named: ReadonlyMap<string, ReadonlySet<PlatformGenre>>
): PlatformTitle {
    if (title.genres.length > 0) {
        return title;
    }
    const genres = named.get(nameKey(title.title));
    return genres ? { ...title, genres: [...genres] } : title;
}

/** A stored row in the panel's list shape, which `toPlatformTitles` reads. */
function toCatalogItem(
    row: StoredVodRow,
    kind: CatalogKind
): PlatformCatalogItem {
    const id = rowId(row, kind);
    const poster = row.stream_icon || row.cover || row.poster_url || undefined;
    const added = String(row.added ?? row.last_modified ?? '');
    return {
        stream_id: id,
        series_id: id,
        name: row.name ?? row.title,
        stream_icon: poster,
        cover: poster,
        added,
        last_modified: row.last_modified ?? added,
        genre: row.genre ?? null,
        // A row stored in a genre's category is of that genre too.
        category_ids:
            row.category_ids ??
            (row.category_id != null ? [row.category_id] : null),
        rating: row.rating ?? null,
        plot: row.plot ?? null,
        backdrop_path: row.backdrop_path ?? row.backdrop_url ?? null,
        tmdb: row.tmdb ?? null,
        tmdb_id: row.tmdb_id ?? null,
        year: row.year ?? null,
        releaseDate: row.releaseDate ?? null,
        release_date: row.release_date ?? null,
    };
}

/** The row's stream (movie) or series id: the provider's, in either shape. */
function rowId(
    row: StoredVodRow,
    kind: CatalogKind
): number | string | undefined {
    return row.xtream_id ?? (kind === 'movie' ? row.stream_id : row.series_id);
}
