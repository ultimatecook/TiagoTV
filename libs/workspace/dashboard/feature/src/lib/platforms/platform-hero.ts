import { seededUnit } from './platform-seed';
import { byDailyRating } from './platform-rows';
import { firstImage, titleKey, type PlatformTitle } from './platform-titles';

/**
 * The platform page's hero: a few recommended titles of the platform, as
 * the Home's first card shows its own. The well rated of what is new,
 * drawn for the day (`daySeed`), movies and series in turn, each with
 * artwork to show; the unrated, drawn the same way, when too few are.
 */
const POOL = 150;
const WELL_RATED = 6.5;

export function pickRecommendations(
    titles: readonly PlatformTitle[],
    count = 6,
    seed = 0
): PlatformTitle[] {
    const pool = titles
        .slice(0, POOL)
        .filter((title) => title.poster || title.backdrop);
    const rated = byDailyRating(
        pool.filter((title) => (title.rating ?? 0) >= WELL_RATED),
        seed,
        'hero'
    );
    const ranked = [
        ...rated,
        ...pool
            .filter((title) => !rated.includes(title))
            .map((title) => ({
                title,
                draw: seededUnit(seed, `hero|${titleKey(title)}`),
            }))
            .sort((a, b) => a.draw - b.draw)
            .map(({ title }) => title),
    ];
    const movies = ranked.filter((title) => title.kind === 'movie');
    const series = ranked.filter((title) => title.kind === 'series');
    const picked: PlatformTitle[] = [];
    for (let i = 0; picked.length < count; i++) {
        if (i >= movies.length && i >= series.length) {
            break;
        }
        for (const title of [movies[i], series[i]]) {
            if (title && picked.length < count) {
                picked.push(title);
            }
        }
    }
    return picked;
}

/** What a title's own page adds to the hero: synopsis, backdrop, genres. */
export interface PlatformTitleExtras {
    readonly plot: string | null;
    readonly backdrop: string | null;
    readonly genres: readonly string[];
}

export interface TitleInfo {
    readonly plot?: string | null;
    readonly description?: string | null;
    readonly backdrop_path?: readonly string[] | string | null;
    readonly genre?: string | null;
}

/** Reads the `info` of a get_vod_info / get_series_info answer. */
export function titleExtras(info: unknown): PlatformTitleExtras {
    const data =
        info && typeof info === 'object' && !Array.isArray(info)
            ? (info as TitleInfo)
            : {};
    return {
        plot: (data.plot || data.description || '').trim() || null,
        backdrop: firstImage(data.backdrop_path),
        genres: (data.genre ?? '')
            .split(/[,/|]/)
            .map((genre) => genre.trim())
            .filter(Boolean)
            .slice(0, 3),
    };
}
