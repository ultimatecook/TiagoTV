import type { PlatformGenre } from '../platforms/platform-genres';
import { titleKey, type PlatformTitle } from '../platforms/platform-titles';
import { mergePlatformTitles } from '../platforms/platform-versions';
import type {
    PlatformTitleKind,
    StreamingPlatform,
} from '../platforms/streaming-platforms';

/**
 * Series / Películas: every platform's titles of one kind in one catalog.
 * A show the provider files on two platforms, or once per language
 * ("MUERTOS S.L." on |ES| Netflix, "DEATH INC." on |EN| Netflix), is one
 * title, shown in Spanish where it has a Spanish version and attributed to
 * the platform of that version.
 */
export type CatalogKind = PlatformTitleKind;

export interface CatalogTitle extends PlatformTitle {
    /** The platform of the version shown: its logo goes on the cards. */
    readonly platform: StreamingPlatform;
    /** Every platform that carries one of its versions, that one first. */
    readonly platforms: readonly StreamingPlatform[];
}

/** One platform's titles, as its categories list them. */
export interface PlatformTitleList {
    readonly platform: StreamingPlatform;
    readonly titles: readonly PlatformTitle[];
}

export interface CatalogRow {
    /** The genre's id, or the platform's for the rows by platform. */
    readonly id: string;
    readonly genre: PlatformGenre | null;
    readonly platform: StreamingPlatform | null;
    readonly titles: readonly CatalogTitle[];
}

/** The page's genres, in the order their rows show. */
export const CATALOG_GENRES: readonly PlatformGenre[] = [
    'action',
    'comedy',
    'drama',
    'thriller',
    'crime',
    'scifi',
    'horror',
    'animation',
    'romance',
    'documentary',
    'adventure',
    'fantasy',
    'mystery',
    'family',
    'history',
    'war',
    'reality',
    'western',
    'music',
];

/** A genre shows as a row from this many titles on. */
export const MIN_ROW_TITLES = 2;
/** Posters per row: the newest of the genre. */
export const MAX_ROW_TITLES = 40;
/** The hero's "Novedades". */
export const NEW_RELEASES = 10;

/** One title per show across every platform and language, newest first. */
export function aggregateCatalog(
    lists: readonly PlatformTitleList[],
    kind: CatalogKind
): CatalogTitle[] {
    const platformOf = new Map<string, StreamingPlatform>();
    const ofKind = lists.map((list) => {
        const titles = list.titles.filter((title) => title.kind === kind);
        for (const title of titles) {
            for (const version of title.versions) {
                platformOf.set(version.categoryId, list.platform);
            }
            platformOf.set(title.categoryId, list.platform);
        }
        return titles;
    });
    const titles: CatalogTitle[] = [];
    for (const title of mergePlatformTitles(ofKind)) {
        const platforms: StreamingPlatform[] = [];
        for (const categoryId of [
            title.categoryId,
            ...title.versions.map((version) => version.categoryId),
        ]) {
            const platform = platformOf.get(categoryId);
            if (platform && !platforms.includes(platform)) {
                platforms.push(platform);
            }
        }
        if (platforms.length > 0) {
            titles.push({ ...title, platform: platforms[0], platforms });
        }
    }
    return titles;
}

/**
 * The hero's "Novedades": the newest titles with artwork, the platforms
 * taking turns (the one with the newest title first) so one platform's
 * batch of uploads does not fill the row.
 */
export function pickNewReleases(
    titles: readonly CatalogTitle[],
    count = NEW_RELEASES
): CatalogTitle[] {
    const withArt = titles.filter((title) => title.poster || title.backdrop);
    const pool =
        withArt.length >= Math.min(count, titles.length) ? withArt : titles;
    const queues = new Map<string, CatalogTitle[]>();
    for (const title of pool) {
        const queue = queues.get(title.platform.id);
        if (queue) {
            queue.push(title);
        } else {
            queues.set(title.platform.id, [title]);
        }
    }
    const picked: CatalogTitle[] = [];
    const turns = [...queues.values()];
    for (let round = 0; picked.length < count; round++) {
        const takers = turns.filter((queue) => round < queue.length);
        if (takers.length === 0) {
            break;
        }
        for (const queue of takers) {
            if (picked.length < count) {
                picked.push(queue[round]);
            }
        }
    }
    return picked;
}

/**
 * One row per genre with at least `MIN_ROW_TITLES` titles, newest first;
 * where no genre gathers that many (a stored catalog that names none),
 * one row per platform instead.
 */
export function buildCatalogRows(
    titles: readonly CatalogTitle[]
): CatalogRow[] {
    const genreRows = CATALOG_GENRES.map((genre): CatalogRow => ({
        id: genre,
        genre,
        platform: null,
        titles: titles
            .filter((title) => title.genres.includes(genre))
            .slice(0, MAX_ROW_TITLES),
    })).filter((row) => row.titles.length >= MIN_ROW_TITLES);
    if (genreRows.length > 0) {
        return genreRows;
    }
    const byPlatform = new Map<string, CatalogTitle[]>();
    for (const title of titles) {
        const list = byPlatform.get(title.platform.id) ?? [];
        list.push(title);
        byPlatform.set(title.platform.id, list);
    }
    return [...byPlatform.values()]
        .filter((list) => list.length >= MIN_ROW_TITLES)
        .map((list) => ({
            id: list[0].platform.id,
            genre: null,
            platform: list[0].platform,
            titles: list.slice(0, MAX_ROW_TITLES),
        }));
}

/**
 * The hero's title: the one picked (`key`), wherever it now sits in the
 * catalog, else the first of the releases.
 */
export function featuredTitle(
    releases: readonly CatalogTitle[],
    titles: readonly CatalogTitle[],
    key: string | null
): CatalogTitle | null {
    return (
        (key ? titles.find((title) => titleKey(title) === key) : undefined) ??
        releases[0] ??
        null
    );
}
