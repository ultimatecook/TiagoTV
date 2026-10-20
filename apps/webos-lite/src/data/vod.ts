import {
    buildPlatformShelves,
    mergePlatformTitles,
    toPlatformTitles,
    type PlatformCatalogItem,
    type PlatformCategory,
    type PlatformTitle,
    type PlatformTitleKind,
    type StreamingPlatform,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { XtreamCategory, XtreamClient } from '../xtream/client';
import { mapSettled } from './pool';

/**
 * "Películas" and "Series": a row per streaming platform, as the desktop
 * Home's platform cards (buildPlatformShelves: Spanish and English
 * categories only), each with its titles once per show, Spanish first
 * (mergePlatformTitles). A row's categories load when it comes into view.
 */
export interface Shelf {
    readonly platform: StreamingPlatform;
    readonly kind: PlatformTitleKind;
    readonly categories: readonly PlatformCategory[];
    /** The bundled logo (img/platforms/…), when the platform has one. */
    readonly logo: string | null;
}

export function shelvesOf(
    kind: PlatformTitleKind,
    vod: readonly XtreamCategory[],
    series: readonly XtreamCategory[]
): Shelf[] {
    return buildPlatformShelves(kind === 'movie' ? vod : [], kind === 'series' ? series : [])
        .map((shelf) => ({
            platform: shelf.platform,
            kind,
            categories: shelf.categories.filter((category) => category.kind === kind),
            logo: shelf.platform.logo
                ? shelf.platform.logo.replace(/^.*\/platforms\//, 'img/platforms/')
                : null,
        }))
        .filter((shelf) => shelf.categories.length > 0);
}

interface RawVodItem extends PlatformCatalogItem {
    readonly container_extension?: string;
}

/** Only what a card and its page read. */
function compactItem(item: RawVodItem): PlatformCatalogItem {
    return {
        stream_id: item.stream_id,
        series_id: item.series_id,
        name: item.name,
        stream_icon: item.stream_icon,
        cover: item.cover,
        added: item.added,
        last_modified: item.last_modified,
        genre: item.genre,
        rating: item.rating,
        plot: item.plot,
        backdrop_path: item.backdrop_path,
        tmdb: item.tmdb,
        tmdb_id: item.tmdb_id,
        year: item.year,
        releaseDate: item.releaseDate,
        release_date: item.release_date,
    };
}

export interface ShelfTitles {
    readonly titles: readonly PlatformTitle[];
    /** A movie's file type by stream id (`mkv`, `mp4`), for its URL. */
    readonly extensions: ReadonlyMap<number, string>;
    readonly failed: number;
}

/** A row lays out its newest titles; the rest of a big catalog waits. */
export const SHELF_LIMIT = 240;

export async function loadShelfTitles(
    client: XtreamClient,
    shelf: Shelf
): Promise<ShelfTitles> {
    const extensions = new Map<number, string>();
    const settled = await mapSettled(shelf.categories, 2, async (category) => {
        const items = await client.streams<RawVodItem>(
            category.kind === 'movie' ? 'vod' : 'series',
            category.id
        );
        if (category.kind === 'movie') {
            for (const item of items) {
                const id = Number(item.stream_id);
                if (Number.isFinite(id) && item.container_extension) {
                    extensions.set(id, String(item.container_extension));
                }
            }
        }
        return toPlatformTitles(category, items.map(compactItem));
    });
    const lists: PlatformTitle[][] = [];
    let failed = 0;
    for (const result of settled) {
        if (result.ok) {
            lists.push(result.value);
        } else {
            failed++;
        }
    }
    if (failed === settled.length && failed > 0) {
        const first = settled[0];
        throw first.ok ? new Error('failed') : first.error;
    }
    return {
        titles: mergePlatformTitles(lists).slice(0, SHELF_LIMIT),
        extensions,
        failed,
    };
}
