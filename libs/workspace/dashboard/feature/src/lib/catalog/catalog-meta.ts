import {
    genreLabelKey,
    type PlatformGenre,
} from '../platforms/platform-genres';
import { runningTime, type CatalogExtras } from './catalog-extras';
import type { CatalogTitle } from './catalog-titles';

/** A text of a meta line: translated (`key`) or as it comes (`text`). */
export interface MetaText {
    readonly key: string | null;
    readonly text: string;
    readonly params?: Readonly<Record<string, unknown>>;
}

/** One part of "Serie · 2025 · Drama, Thriller · 1 temporada". */
export type MetaPart = readonly MetaText[];

const KEYS = 'WORKSPACE.CATALOG.';
const translated = (
    key: string,
    params?: Readonly<Record<string, unknown>>
): MetaText => ({ key, text: '', params });
const plain = (text: string): MetaText => ({ key: null, text });

/** The hero's line: the kind, the year, the genres and the length. */
export function heroMeta(
    title: CatalogTitle,
    extras: CatalogExtras | null
): MetaPart[] {
    const parts: MetaPart[] = [
        [translated(KEYS + (title.kind === 'movie' ? 'MOVIE' : 'SERIE'))],
    ];
    const year = title.year ?? extras?.year ?? null;
    if (year) {
        parts.push([plain(String(year))]);
    }
    const genres: MetaText[] =
        title.genres.length > 0
            ? title.genres
                  .slice(0, 2)
                  .map((genre) => translated(genreLabelKey(genre)))
            : (extras?.genres ?? []).slice(0, 2).map(plain);
    if (genres.length > 0) {
        parts.push(genres);
    }
    const length = lengthText(title, extras);
    if (length) {
        parts.push([length]);
    }
    return parts;
}

/**
 * Under a poster: the year, a genre (another than the row's, where the
 * title has one) and the rating; the platform's name when none is known.
 */
export function posterMeta(
    title: CatalogTitle,
    rowGenre: PlatformGenre | null
): MetaPart[] {
    const parts: MetaPart[] = [];
    if (title.year) {
        parts.push([plain(String(title.year))]);
    }
    const genre =
        title.genres.find((candidate) => candidate !== rowGenre) ??
        title.genres[0];
    if (genre) {
        parts.push([translated(genreLabelKey(genre))]);
    }
    if (title.rating) {
        parts.push([plain(`★ ${title.rating.toFixed(1)}`)]);
    }
    return parts.length > 0 ? parts : [[plain(title.platform.name)]];
}

function lengthText(
    title: CatalogTitle,
    extras: CatalogExtras | null
): MetaText | null {
    if (title.kind === 'series') {
        const seasons = extras?.seasons ?? null;
        if (!seasons) {
            return null;
        }
        return seasons === 1
            ? translated(KEYS + 'SEASON_ONE')
            : translated(KEYS + 'SEASONS', { count: seasons });
    }
    const minutes = extras?.minutes ?? null;
    if (!minutes) {
        return null;
    }
    const time = runningTime(minutes);
    return typeof time === 'number'
        ? translated(KEYS + 'DURATION_M', { minutes: time })
        : translated(KEYS + 'DURATION_HM', time);
}
