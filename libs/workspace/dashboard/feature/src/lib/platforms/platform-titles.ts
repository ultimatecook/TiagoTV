import { displayTitle } from '@iptvnator/shared/interfaces';
import { genreLabelKey, genresIn, type PlatformGenre } from './platform-genres';
import type {
    PlatformCategory,
    PlatformLanguage,
    PlatformTitleKind,
} from './streaming-platforms';

export interface PlatformTitle {
    readonly id: number;
    readonly kind: PlatformTitleKind;
    readonly categoryId: string;
    readonly title: string;
    readonly poster: string | null;
    readonly language: PlatformLanguage;
    /** Seconds since the epoch the provider added (or updated) it. */
    readonly added: number;
    readonly genres: readonly PlatformGenre[];
    /** The provider's 0–10 rating, when it gives one. */
    readonly rating: number | null;
    /** Series lists carry their synopsis and backdrop; movies' come later. */
    readonly plot: string | null;
    readonly backdrop: string | null;
}

/** A VOD or series entry of a platform category, as the page shows it. */
export interface PlatformCatalogItem {
    readonly stream_id?: number | string;
    readonly series_id?: number | string;
    readonly name?: string;
    readonly stream_icon?: string;
    readonly cover?: string;
    readonly added?: string;
    readonly last_modified?: string;
    readonly genre?: string | null;
    readonly category_ids?: readonly (number | string)[] | null;
    readonly rating?: number | string | null;
    readonly plot?: string | null;
    readonly backdrop_path?: readonly string[] | string | null;
}

export function toPlatformTitles(
    category: PlatformCategory,
    items: readonly PlatformCatalogItem[],
    genreCategories: ReadonlyMap<string, readonly PlatformGenre[]> = new Map()
): PlatformTitle[] {
    const titles: PlatformTitle[] = [];
    for (const item of items) {
        const id = Number(
            category.kind === 'movie' ? item.stream_id : item.series_id
        );
        if (!Number.isFinite(id) || !item.name) {
            continue;
        }
        const genres = new Set(genresIn(item.genre));
        for (const categoryId of item.category_ids ?? []) {
            for (const genre of genreCategories.get(String(categoryId)) ?? []) {
                genres.add(genre);
            }
        }
        titles.push({
            id,
            kind: category.kind,
            categoryId: category.id,
            title: displayTitle(item.name),
            poster:
                (category.kind === 'movie' ? item.stream_icon : item.cover) ||
                null,
            language: category.language,
            added:
                Number(
                    category.kind === 'movie' ? item.added : item.last_modified
                ) || 0,
            genres: [...genres],
            rating: readRating(item.rating),
            plot: item.plot?.trim() || null,
            backdrop: firstImage(item.backdrop_path),
        });
    }
    return titles;
}

/** Newest first; a title filed in two of the platform's categories once. */
export function mergePlatformTitles(
    lists: readonly (readonly PlatformTitle[])[]
): PlatformTitle[] {
    const seen = new Set<string>();
    const merged: PlatformTitle[] = [];
    for (const list of lists) {
        for (const title of list) {
            const key = `${title.kind}:${title.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(title);
            }
        }
    }
    return merged.sort((a, b) => b.added - a.added);
}

export interface PlatformRow {
    readonly id: string;
    readonly labelKey: string;
    readonly labelParams?: Readonly<Record<string, string>>;
    /** Newest first, or by rank in a ranked row. */
    readonly titles: readonly PlatformTitle[];
    /** A "Top 10": each title carries its place, the best first. */
    readonly ranked?: boolean;
}

export interface PlatformRowOptions {
    /** Adds Netflix's "Top 10 on Netflix" row after what is new. */
    readonly top10Of?: string;
}

/** The newest-titles row shows the latest additions only. */
const NEWEST_LIMIT = 30;
/** A genre needs this many titles for a row of its own. */
const GENRE_MIN_TITLES = 6;
const GENRE_ROW_LIMIT = 10;
/** The Top 10 ranks the best rated of the platform's recent titles. */
const TOP_POOL = 150;
const TOP_COUNT = 10;

/**
 * The platform page's rows, as the platforms lay out their own: what is
 * new, its movies, its series, then its genres, the largest first.
 */
export function buildPlatformRows(
    titles: readonly PlatformTitle[],
    options: PlatformRowOptions = {}
): PlatformRow[] {
    const rows: PlatformRow[] = [];
    const push = (id: string, labelKey: string, list: PlatformTitle[]) => {
        if (list.length > 0) {
            rows.push({ id, labelKey, titles: list });
        }
    };
    push('newest', 'WORKSPACE.PLATFORMS.NEWEST', titles.slice(0, NEWEST_LIMIT));
    const top = options.top10Of ? topRated(titles) : [];
    if (options.top10Of && top.length >= 3) {
        rows.push({
            id: 'top10',
            labelKey: 'WORKSPACE.PLATFORMS.TOP10',
            labelParams: { platform: options.top10Of },
            titles: top,
            ranked: true,
        });
    }
    push(
        'movies',
        'WORKSPACE.PLATFORMS.MOVIES',
        titles.filter((title) => title.kind === 'movie')
    );
    push(
        'series',
        'WORKSPACE.PLATFORMS.SERIES',
        titles.filter((title) => title.kind === 'series')
    );

    const byGenre = new Map<PlatformGenre, PlatformTitle[]>();
    for (const title of titles) {
        for (const genre of title.genres) {
            const list = byGenre.get(genre) ?? [];
            list.push(title);
            byGenre.set(genre, list);
        }
    }
    [...byGenre.entries()]
        .filter(([, list]) => list.length >= GENRE_MIN_TITLES)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, GENRE_ROW_LIMIT)
        .forEach(([genre, list]) =>
            push(`genre-${genre}`, genreLabelKey(genre), list)
        );
    return rows;
}

/** The best rated of the recent titles with a poster, newest on a tie. */
export function topRated(titles: readonly PlatformTitle[]): PlatformTitle[] {
    return titles
        .slice(0, TOP_POOL)
        .filter((title) => title.poster && (title.rating ?? 0) > 0)
        .map((title, index) => ({ title, index }))
        .sort(
            (a, b) =>
                (b.title.rating ?? 0) - (a.title.rating ?? 0) ||
                a.index - b.index
        )
        .slice(0, TOP_COUNT)
        .map(({ title }) => title);
}

function readRating(value: number | string | null | undefined): number | null {
    const rating = typeof value === 'number' ? value : parseFloat(value ?? '');
    return Number.isFinite(rating) && rating > 0 && rating <= 10
        ? rating
        : null;
}

/** The first web image of a backdrop list (or of a single URL). */
export function firstImage(
    value: readonly string[] | string | null | undefined
): string | null {
    const list = typeof value === 'string' ? [value] : (value ?? []);
    return list.find((url) => /^https?:\/\//.test(url ?? '')) ?? null;
}
