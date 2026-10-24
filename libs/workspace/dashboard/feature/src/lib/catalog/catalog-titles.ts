import type { PlatformGenre } from '../platforms/platform-genres';
import {
    titleKey,
    type PlatformTitle,
    type PlatformTitleVersion,
} from '../platforms/platform-titles';
import { mergePlatformTitles } from '../platforms/platform-versions';
import type {
    PlatformLanguage,
    PlatformTitleKind,
    StreamingPlatform,
    StreamingPlatformId,
} from '../platforms/streaming-platforms';
import { creditPlatform, takeTurns } from './catalog-fairness';

/**
 * Series / Películas: every platform's titles of one kind in one catalog.
 * A show the provider files on two platforms, or once per language
 * ("MUERTOS S.L." on |ES| Netflix, "DEATH INC." on |EN| Netflix), is one
 * title, shown in the preferred language where it has a version in it
 * (`PREFERRED_VERSION_LANGUAGE`: English, its original, unless the user
 * chose the Spanish dub). A show several
 * platforms carry counts for the one with fewer titles (`creditPlatform`).
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
/**
 * The genre rows hold a platform's titles where at least this share of
 * them names a genre; the others get a row of their own.
 */
export const GENRE_COVERAGE = 0.5;

/**
 * One title per show across every platform and language, the platforms
 * taking turns (see `takeTurns`), each platform's titles newest first.
 */
export function aggregateCatalog(
    lists: readonly PlatformTitleList[],
    kind: CatalogKind,
    preferred: PlatformLanguage = 'ES'
): CatalogTitle[] {
    const platformOf = new Map<string, StreamingPlatform>();
    /** A stream the provider files on two platforms is listed once. */
    const streamOn = new Map<number, StreamingPlatform[]>();
    const sizes = new Map<StreamingPlatformId, number>();
    const ofKind = lists.map((list) => {
        const titles = list.titles.filter((title) => title.kind === kind);
        sizes.set(
            list.platform.id,
            (sizes.get(list.platform.id) ?? 0) + titles.length
        );
        for (const title of titles) {
            for (const version of [title, ...title.versions]) {
                platformOf.set(version.categoryId, list.platform);
                const on = streamOn.get(version.id) ?? [];
                if (!on.includes(list.platform)) {
                    on.push(list.platform);
                }
                streamOn.set(version.id, on);
            }
        }
        return titles;
    });
    const platformsOf = (version: PlatformTitleVersion) => {
        const own = platformOf.get(version.categoryId);
        const others = streamOn.get(version.id) ?? [];
        return own ? [own, ...others.filter((item) => item !== own)] : others;
    };
    const titles: CatalogTitle[] = [];
    for (const title of mergePlatformTitles(ofKind, preferred)) {
        const platforms: StreamingPlatform[] = [];
        for (const version of title.versions.length > 0
            ? title.versions
            : [title]) {
            for (const platform of platformsOf(version)) {
                if (!platforms.includes(platform)) {
                    platforms.push(platform);
                }
            }
        }
        if (platforms.length > 0) {
            const credited = creditPlatform(
                title,
                platforms,
                platformsOf,
                sizes
            );
            titles.push({
                ...credited.title,
                platform: credited.platform,
                platforms: [
                    credited.platform,
                    ...platforms.filter((item) => item !== credited.platform),
                ],
            });
        }
    }
    return takeTurns(titles);
}

/**
 * The hero's "Novedades": the newest titles with artwork, the platforms
 * taking turns so one platform's batch of uploads does not fill the row.
 * The platform with the newest title leads, or the `lead`-th one (drawn
 * each session), so the hero does not always feature the same platform.
 */
export function pickNewReleases(
    titles: readonly CatalogTitle[],
    count = NEW_RELEASES,
    lead = 0
): CatalogTitle[] {
    const withArt = titles.filter((title) => title.poster || title.backdrop);
    const pool =
        withArt.length >= Math.min(count, titles.length) ? withArt : titles;
    return takeTurns(pool, count, lead);
}

/**
 * One row per genre with at least `MIN_ROW_TITLES` titles (in the
 * catalog's order: the platforms taking turns, newest first), and one row
 * per platform for the platforms whose titles mostly name no genre (the
 * stored catalog in Electron names none; only the platform pages already
 * opened lend theirs). Where fewer than two platforms name genres, the
 * genre rows would show those alone: one row per platform instead.
 */
export function buildCatalogRows(
    titles: readonly CatalogTitle[]
): CatalogRow[] {
    const byPlatform = new Map<StreamingPlatformId, CatalogTitle[]>();
    for (const title of titles) {
        const list = byPlatform.get(title.platform.id) ?? [];
        list.push(title);
        byPlatform.set(title.platform.id, list);
    }
    const platformRows: CatalogRow[] = [];
    const unnamed: CatalogRow[] = [];
    for (const list of byPlatform.values()) {
        if (list.length < MIN_ROW_TITLES) {
            continue;
        }
        const row: CatalogRow = {
            id: list[0].platform.id,
            genre: null,
            platform: list[0].platform,
            titles: list.slice(0, MAX_ROW_TITLES),
        };
        platformRows.push(row);
        const named = list.filter((title) => title.genres.length > 0);
        if (named.length < GENRE_COVERAGE * list.length) {
            unnamed.push(row);
        }
    }
    const namedCount = platformRows.length - unnamed.length;
    if (unnamed.length > 0 && namedCount < 2) {
        return platformRows;
    }
    const genreRows = CATALOG_GENRES.map((genre): CatalogRow => ({
        id: genre,
        genre,
        platform: null,
        titles: titles
            .filter((title) => title.genres.includes(genre))
            .slice(0, MAX_ROW_TITLES),
    })).filter((row) => row.titles.length >= MIN_ROW_TITLES);
    return genreRows.length > 0 ? genreRows.concat(unnamed) : platformRows;
}

/**
 * The hero's title: the one picked (`key`), wherever it now sits in the
 * catalog — also once it shows another of its versions (its Spanish one
 * arrived, or another platform now credits it) — else the first of the
 * releases.
 */
export function featuredTitle(
    releases: readonly CatalogTitle[],
    titles: readonly CatalogTitle[],
    key: string | null
): CatalogTitle | null {
    const picked = key
        ? (titles.find((title) => titleKey(title) === key) ??
          titles.find((title) =>
              title.versions.some(
                  (version) => `${title.kind}:${version.id}` === key
              )
          ))
        : undefined;
    return picked ?? releases[0] ?? null;
}
