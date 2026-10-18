import {
    findStreamingPlatform,
    type PlatformShelf,
    type PlatformTitleKind,
    type StreamingPlatform,
} from './streaming-platforms';

/** A page that belongs to a streaming platform, read from its URL. */
export type PlatformRoute =
    | { readonly page: 'platform'; readonly platformId: string }
    | {
          readonly page: 'detail';
          readonly playlistId: string;
          readonly kind: PlatformTitleKind;
          readonly categoryId: string;
      };

const PLATFORM_PAGE = /^\/workspace\/platforms\/([^/?#;]+)/;
const DETAIL_PAGE =
    /^\/workspace\/xtreams\/([^/?#;]+)\/(vod|series)\/([^/?#;]+)\/[^/?#;]+/;

/**
 * The platform page (/workspace/platforms/netflix) or a movie or series
 * page of the Xtream source (…/vod/:categoryId/:vodId); anything else is
 * no platform's.
 */
export function readPlatformRoute(url: string): PlatformRoute | null {
    const platform = PLATFORM_PAGE.exec(url);
    if (platform) {
        return { page: 'platform', platformId: decode(platform[1]) };
    }
    const detail = DETAIL_PAGE.exec(url);
    if (detail) {
        return {
            page: 'detail',
            playlistId: decode(detail[1]),
            kind: detail[2] === 'vod' ? 'movie' : 'series',
            categoryId: decode(detail[3]),
        };
    }
    return null;
}

/**
 * The platform a page belongs to: the platform page's own, or for a title
 * of the platforms' source, the platform whose catalog files its category
 * ("|ES| ✪ ORIGINAL NETFLIX").
 */
export function platformOfRoute(
    route: PlatformRoute | null,
    sourceId: string | null,
    shelves: readonly PlatformShelf[] | null
): StreamingPlatform | null {
    if (!route) {
        return null;
    }
    if (route.page === 'platform') {
        return findStreamingPlatform(route.platformId);
    }
    if (route.playlistId !== sourceId || !shelves) {
        return null;
    }
    const shelf = shelves.find((candidate) =>
        candidate.categories.some(
            (category) =>
                category.id === route.categoryId && category.kind === route.kind
        )
    );
    return shelf?.platform ?? null;
}

function decode(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}
