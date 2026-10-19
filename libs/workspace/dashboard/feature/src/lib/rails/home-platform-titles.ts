import { splitSeasonSuffix } from '@iptvnator/portal/shared/util';
import type { MetaPart } from '../catalog/catalog-meta';
import type { CatalogTitle } from '../catalog/catalog-titles';
import { byDailyRating } from '../platforms/platform-rows';
import { titleKey, type PlatformTitle } from '../platforms/platform-titles';
import type {
    PlatformShelf,
    PlatformTitleKind,
    StreamingPlatform,
} from '../platforms/streaming-platforms';

/**
 * The Home's picks from the platforms' aggregated catalog ("Top 10
 * películas hoy", "Series para vos"): `CatalogService` titles, one per
 * show across platforms and languages, newest first, each with the
 * platform of the version shown.
 */
export type HomeSeriesBadgeKind = 'new-episode' | 'season' | 'premiere';

export interface HomeSeriesBadge {
    readonly kind: HomeSeriesBadgeKind;
    /** The season a "Temporada N" badge names. */
    readonly season?: number;
}

export const TOP_MOVIES_COUNT = 10;
/** The Top 10 ranks the platforms' newest titles, not their classics. */
const TOP_POOL = 150;
const SERIES_POOL = 150;
const DAY_S = 24 * 60 * 60;
const NEW_EPISODE_S = 7 * DAY_S;
const RECENT_S = 30 * DAY_S;

/** The platform a catalog category belongs to, if any. */
export function platformOfCategory(
    shelves: readonly PlatformShelf[],
    kind: 'live' | PlatformTitleKind,
    categoryId: string | number | null | undefined
): StreamingPlatform | null {
    const id = String(categoryId ?? '');
    if (!id || kind === 'live') {
        return null;
    }
    return (
        shelves.find((shelf) =>
            shelf.categories.some(
                (category) => category.kind === kind && category.id === id
            )
        )?.platform ?? null
    );
}

/**
 * "Top 10 películas hoy": the best rated of the platforms' newest movies
 * with a poster, each moved a little by the day's draw (`seed`, see
 * `byDailyRating`) so the list changes from one day to the next; the
 * newest unrated ones fill the list when too few are rated.
 */
export function rankTopMovies(
    titles: readonly CatalogTitle[],
    seed = 0
): CatalogTitle[] {
    const pool = titles
        .filter((title) => title.kind === 'movie')
        .slice(0, TOP_POOL)
        .filter((title) => !!title.poster);
    const rated = byDailyRating(
        pool.filter((title) => (title.rating ?? 0) > 0),
        seed,
        'home-top10'
    );
    const unrated = pool.filter((title) => !title.rating);
    return asCatalogTitles(pool, [...rated, ...unrated]).slice(
        0,
        TOP_MOVIES_COUNT
    );
}

/**
 * "Series para vos": three of the platforms' newest well rated series,
 * drawn for the day. The featured one (first) is one with a backdrop and
 * a synopsis where any has them; the two beside it follow in order.
 */
export function pickSeriesForYou(
    titles: readonly CatalogTitle[],
    seed = 0,
    count = 3
): CatalogTitle[] {
    const pool = titles
        .filter((title) => title.kind === 'series')
        .slice(0, SERIES_POOL)
        .filter((title) => !!(title.backdrop || title.poster));
    const ranked = asCatalogTitles(
        pool,
        byDailyRating(pool, seed, 'home-series')
    );
    const featured =
        ranked
            .slice(0, count * 3)
            .find((title) => !!title.backdrop && !!title.plot) ?? ranked[0];
    if (!featured) {
        return [];
    }
    return [featured, ...ranked.filter((title) => title !== featured)].slice(
        0,
        count
    );
}

/**
 * The badge a series earns from what its catalog entry says, or none:
 * "Estreno" for a show of this year added in the last month, "Temporada N"
 * for a later season (named in its title) added in the last month, "Nuevo
 * episodio" for an older show the provider updated this week.
 */
export function seriesBadge(
    title: PlatformTitle,
    now: Date = new Date()
): HomeSeriesBadge | null {
    if (title.kind !== 'series' || title.added <= 0) {
        return null;
    }
    const age = now.getTime() / 1000 - title.added;
    if (age < 0 || age > RECENT_S) {
        return null;
    }
    const { season } = splitSeasonSuffix(title.title);
    if (season !== null && season > 1) {
        return { kind: 'season', season };
    }
    const thisYear = now.getFullYear();
    if (title.year === thisYear) {
        return { kind: 'premiere' };
    }
    return title.year !== null && title.year < thisYear && age <= NEW_EPISODE_S
        ? { kind: 'new-episode' }
        : null;
}

/** A series' name without a trailing season marker ("… Season 2"). */
export function seriesName(title: PlatformTitle): string {
    return splitSeasonSuffix(title.title).title;
}

/** A catalog meta line ("2024 · Crimen, Thriller · 2 temporadas"), read. */
export function metaLine(
    parts: readonly MetaPart[],
    translate: (key: string, params?: Record<string, unknown>) => string
): string[] {
    return parts
        .map((part) =>
            part
                .map((text) =>
                    text.key
                        ? translate(
                              text.key,
                              text.params ? { ...text.params } : undefined
                          )
                        : text.text
                )
                .filter(Boolean)
                .join(', ')
        )
        .filter(Boolean);
}

/** `byDailyRating`'s order, as the catalog's own titles. */
function asCatalogTitles(
    pool: readonly CatalogTitle[],
    order: readonly PlatformTitle[]
): CatalogTitle[] {
    const byKey = new Map(pool.map((title) => [titleKey(title), title]));
    return order
        .map((title) => byKey.get(titleKey(title)))
        .filter((title): title is CatalogTitle => !!title);
}
