import { displayTitle } from '@iptvnator/shared/interfaces';
import { genresIn, type PlatformGenre } from './platform-genres';
import type {
    PlatformCategory,
    PlatformLanguage,
    PlatformTitleKind,
} from './streaming-platforms';

/** One language version of a title: its own stream, name and category. */
export interface PlatformTitleVersion {
    readonly id: number;
    readonly categoryId: string;
    readonly language: PlatformLanguage;
    readonly title: string;
}

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
    /** The TMDB id the provider's list gives (`tmdb` or `tmdb_id`). */
    readonly tmdb: number | null;
    readonly year: number | null;
    /**
     * The title in each language the provider files it in ("MUERTOS S.L."
     * in Spanish, "DEATH INC." in English), the one shown first; the
     * title's own fields are that version's.
     */
    readonly versions: readonly PlatformTitleVersion[];
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
    readonly tmdb?: number | string | null;
    readonly tmdb_id?: number | string | null;
    readonly year?: number | string | null;
    readonly releaseDate?: string | null;
    readonly release_date?: string | null;
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
        const title = displayTitle(item.name);
        titles.push({
            id,
            kind: category.kind,
            categoryId: category.id,
            title,
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
            tmdb: readTmdbId(item.tmdb ?? item.tmdb_id),
            year: readYear(item),
            versions: [
                {
                    id,
                    categoryId: category.id,
                    language: category.language,
                    title,
                },
            ],
        });
    }
    return titles;
}

/** The same title on a page: its kind and the id of its first version. */
export function titleKey(title: PlatformTitle): string {
    return `${title.kind}:${title.id}`;
}

/** One version per language, in the title's order ("ES", then "EN"). */
export function languageVersions(title: PlatformTitle): PlatformTitleVersion[] {
    const seen = new Set<PlatformLanguage>();
    return title.versions.filter((version) => {
        if (seen.has(version.language)) {
            return false;
        }
        seen.add(version.language);
        return true;
    });
}

/** "ES · EN": the languages a title is available in. */
export function languagesLabel(title: PlatformTitle): string {
    const versions = languageVersions(title);
    return versions.length > 0
        ? versions.map((version) => version.language).join(' · ')
        : title.language;
}

function readRating(value: number | string | null | undefined): number | null {
    const rating = typeof value === 'number' ? value : parseFloat(value ?? '');
    return Number.isFinite(rating) && rating > 0 && rating <= 10
        ? rating
        : null;
}

/** Providers send the id as a number, a numeric string, "" or "0". */
function readTmdbId(value: number | string | null | undefined): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

const YEAR = /^\s*((?:19|20)\d{2})/;
/** "MUERTOS S.L. (2024) ES", "Fauda [2015]", "EN - TONY - 2026". */
const NAMED_YEAR =
    /[([]\s*((?:19|20)\d{2})\s*[)\]]|\s[-–]\s((?:19|20)\d{2})\s*$/;

/** The release year: the list's own field, else the one in the name. */
function readYear(item: PlatformCatalogItem): number | null {
    for (const value of [item.year, item.releaseDate, item.release_date]) {
        const match = YEAR.exec(String(value ?? ''));
        if (match) {
            return Number(match[1]);
        }
    }
    const named = NAMED_YEAR.exec(item.name ?? '');
    return named ? Number(named[1] ?? named[2]) : null;
}

/** The first web image of a backdrop list (or of a single URL). */
export function firstImage(
    value: readonly string[] | string | null | undefined
): string | null {
    const list = typeof value === 'string' ? [value] : (value ?? []);
    return list.find((url) => /^https?:\/\//.test(url ?? '')) ?? null;
}
