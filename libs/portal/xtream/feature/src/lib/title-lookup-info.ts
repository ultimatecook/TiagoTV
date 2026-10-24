import type { TitleLookupInfo } from '@iptvnator/services';
import type {
    XtreamSerieInfo,
    XtreamVodInfo,
} from '@iptvnator/shared/interfaces';

/**
 * What a title page tells the app about its title for lookups beyond its
 * platform (OpenSubtitles): the name (a movie's original one where the
 * provider gives it), the year and the ids. Providers send the TMDB id as
 * `tmdb_id` or `tmdb`, as a number or a string, "" or "0" for none.
 */
export function vodLookupInfo(
    info: Partial<XtreamVodInfo> | null | undefined,
    fallbackName?: string | null
): TitleLookupInfo | null {
    const name = (info?.o_name || info?.name || fallbackName || '').trim();
    if (!name) {
        return null;
    }
    const raw = info as Record<string, unknown> | null | undefined;
    return {
        name,
        year: yearOf(info?.releasedate),
        tmdbId: idOf(raw?.['tmdb_id'] ?? raw?.['tmdb']),
        imdbId: imdbOf(raw?.['imdb_id']),
    };
}

export function seriesLookupInfo(
    info: Partial<XtreamSerieInfo> | null | undefined
): TitleLookupInfo | null {
    const name = info?.name?.trim() ?? '';
    if (!name) {
        return null;
    }
    const raw = info as Record<string, unknown>;
    return {
        name,
        year: yearOf(info?.releaseDate ?? (raw['releasedate'] as string)),
        tmdbId: idOf(raw['tmdb_id'] ?? raw['tmdb']),
        imdbId: imdbOf(raw['imdb_id']),
    };
}

function idOf(value: unknown): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function imdbOf(value: unknown): string | null {
    return typeof value === 'string' && /^tt\d{5,10}$/i.test(value.trim())
        ? value.trim()
        : null;
}

function yearOf(value: unknown): number | null {
    const match = /^\s*((?:19|20)\d{2})/.exec(String(value ?? ''));
    return match ? Number(match[1]) : null;
}
