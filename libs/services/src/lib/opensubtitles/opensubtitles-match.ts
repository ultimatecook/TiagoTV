import { displayTitle } from '@iptvnator/shared/interfaces';

/** The movie or episode a subtitle is looked up for. */
export interface SubtitleLookup {
    readonly kind: 'movie' | 'episode';
    /** The movie's or the series' name, as the provider lists it. */
    readonly title: string;
    readonly year?: number | null;
    /** The movie's TMDB id, or the series' for an episode. */
    readonly tmdbId?: number | null;
    /** `tt0123456` or its digits: the movie's, or the series' for an episode. */
    readonly imdbId?: string | null;
    readonly season?: number | null;
    readonly episode?: number | null;
}

/** One entry of `GET /subtitles`, the fields the choice reads. */
export interface OpenSubtitlesResult {
    readonly id?: string;
    readonly attributes?: {
        readonly language?: string;
        readonly download_count?: number;
        readonly ratings?: number;
        readonly hearing_impaired?: boolean;
        readonly ai_translated?: boolean;
        readonly machine_translated?: boolean;
        readonly from_trusted?: boolean;
        readonly foreign_parts_only?: boolean;
        readonly release?: string;
        readonly files?: readonly {
            readonly file_id?: number;
            readonly file_name?: string;
        }[];
        readonly feature_details?: {
            readonly year?: number;
            readonly season_number?: number;
            readonly episode_number?: number;
        };
    };
}

export interface ChosenSubtitle {
    readonly fileId: number;
    readonly language: string;
    readonly release: string;
}

/** The Spanish family OpenSubtitles files apart: any, Spain, Latin America. */
const SPANISH_CODES = ['es', 'sp', 'ea'];

/**
 * The languages one search asks for: the chosen one first, and for Spanish
 * the other Spanish codes after it (most Spanish subtitles are filed as
 * `es`, many Latin American ones as `ea`).
 */
export function searchLanguages(language: string): string[] {
    const code = language.toLowerCase();
    return SPANISH_CODES.includes(code)
        ? [code, ...SPANISH_CODES.filter((other) => other !== code)]
        : [code];
}

function imdbDigits(value: string | null | undefined): string | null {
    const digits = /^(?:tt)?0*(\d{1,10})$/i.exec(value?.trim() ?? '')?.[1];
    return digits ?? null;
}

function positive(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value > 0
        ? value
        : null;
}

/**
 * The search's query strings, most precise first: by TMDB id, by IMDB id,
 * then by name and year. Keys sorted and values lowercased, as the API
 * asks (anything else answers with a redirect).
 */
export function buildSearchQueries(
    lookup: SubtitleLookup,
    languages: readonly string[]
): Record<string, string>[] {
    const episode = lookup.kind === 'episode';
    const base: Record<string, string> = {
        languages: [...languages].map((code) => code.toLowerCase()).sort().join(','),
        type: episode ? 'episode' : 'movie',
    };
    if (episode) {
        const season = positive(lookup.season);
        const number = positive(lookup.episode);
        if (season === null || number === null) {
            return [];
        }
        base['season_number'] = String(season);
        base['episode_number'] = String(number);
    }
    const queries: Record<string, string>[] = [];
    const tmdb = positive(lookup.tmdbId);
    const imdb = imdbDigits(lookup.imdbId);
    if (tmdb !== null) {
        queries.push({ ...base, [episode ? 'parent_tmdb_id' : 'tmdb_id']: String(tmdb) });
    }
    if (imdb !== null) {
        queries.push({ ...base, [episode ? 'parent_imdb_id' : 'imdb_id']: imdb });
    }
    const name = displayTitle(lookup.title).trim().toLowerCase();
    if (name) {
        const year = positive(lookup.year);
        queries.push({
            ...base,
            query: name,
            ...(year !== null && !episode ? { year: String(year) } : {}),
        });
    }
    return queries.map(sortKeys);
}

function sortKeys(query: Record<string, string>): Record<string, string> {
    return Object.keys(query)
        .sort()
        .reduce<Record<string, string>>((sorted, key) => {
            sorted[key] = query[key];
            return sorted;
        }, {});
}

/**
 * The best subtitle of a search: one in the first language that has any;
 * of those a human translation before a machine one, a full one (not the
 * forced "foreign parts only"), not for the hearing impaired before one
 * that is, a trusted uploader's, then the most downloaded and best rated.
 * Results for another episode, or (by name) for another year, are left
 * out. Null when nothing fits.
 */
export function pickBestSubtitle(
    results: readonly OpenSubtitlesResult[],
    languages: readonly string[],
    lookup: SubtitleLookup
): ChosenSubtitle | null {
    const order = languages.map((code) => code.toLowerCase());
    const candidates = results.filter((result) => {
        const attributes = result.attributes;
        const language = attributes?.language?.toLowerCase() ?? '';
        const details = attributes?.feature_details;
        if (
            !attributes?.files?.[0]?.file_id ||
            !order.includes(language) ||
            attributes.foreign_parts_only === true
        ) {
            return false;
        }
        if (lookup.kind === 'episode') {
            return (
                !differsFrom(details?.season_number, lookup.season) &&
                !differsFrom(details?.episode_number, lookup.episode)
            );
        }
        const year = positive(lookup.year);
        return !(
            year !== null &&
            typeof details?.year === 'number' &&
            details.year > 0 &&
            Math.abs(details.year - year) > 1
        );
    });
    const rank = (result: OpenSubtitlesResult): number[] => {
        const a = result.attributes ?? {};
        return [
            order.indexOf(a.language?.toLowerCase() ?? ''),
            a.machine_translated || a.ai_translated ? 1 : 0,
            a.hearing_impaired ? 1 : 0,
            a.from_trusted ? 0 : 1,
            -(a.download_count ?? 0),
            -(a.ratings ?? 0),
        ];
    };
    const best = [...candidates].sort((x, y) => compareRanks(rank(x), rank(y)))[0];
    const file = best?.attributes?.files?.[0];
    return best && file?.file_id
        ? {
              fileId: file.file_id,
              language: best.attributes?.language?.toLowerCase() ?? order[0],
              release: best.attributes?.release ?? file.file_name ?? '',
          }
        : null;
}

/** False when the result agrees (or does not say); true when it differs. */
function differsFrom(
    reported: number | undefined,
    wanted: number | null | undefined
): boolean {
    return (
        typeof reported === 'number' &&
        reported > 0 &&
        typeof wanted === 'number' &&
        reported !== wanted
    );
}

function compareRanks(a: number[], b: number[]): number {
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) {
            return a[index] - b[index];
        }
    }
    return 0;
}

/** The cache key of a title's subtitle in one language. */
export function subtitleCacheKey(
    lookup: SubtitleLookup,
    language: string
): string {
    const id =
        positive(lookup.tmdbId) !== null
            ? `tmdb:${lookup.tmdbId}`
            : imdbDigits(lookup.imdbId) !== null
              ? `imdb:${imdbDigits(lookup.imdbId)}`
              : `name:${displayTitle(lookup.title).trim().toLowerCase()}:${positive(lookup.year) ?? ''}`;
    const episode =
        lookup.kind === 'episode'
            ? `:s${lookup.season ?? 0}e${lookup.episode ?? 0}`
            : '';
    return `${lookup.kind}:${id}${episode}:${language.toLowerCase()}`;
}
