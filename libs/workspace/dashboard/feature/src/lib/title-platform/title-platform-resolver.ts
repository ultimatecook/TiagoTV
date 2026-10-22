import type { TitlePlatformBrand, TitlePlatformRef } from '@iptvnator/services';
import { platformOfRoute } from '../platforms/platform-theme';
import type {
    PlatformShelf,
    StreamingPlatform,
} from '../platforms/streaming-platforms';

/** What the resolver reads: the platforms' source, lists and members. */
export interface TitlePlatformSources {
    readonly sourceId: string | null;
    readonly shelves: readonly PlatformShelf[] | null;
    /** The platform whose own list carries the title (stored membership). */
    readonly memberOf: (
        kind: TitlePlatformRef['kind'],
        id: number
    ) => StreamingPlatform | null;
}

/**
 * The platform a title belongs to, wherever its page was opened: the one
 * whose catalog files the category it was opened in (as the platform
 * page's theme reads it), else the one whose own list carries it. Search,
 * Mi lista and "Continue watching" open a title in the category the app
 * stored, often a genre's, so the membership is what tells them apart.
 */
export function titlePlatform(
    ref: TitlePlatformRef,
    sources: TitlePlatformSources
): StreamingPlatform | null {
    if (!sources.sourceId || ref.playlistId !== sources.sourceId) {
        return null;
    }
    const categoryId =
        ref.categoryId === null || ref.categoryId === undefined
            ? ''
            : String(ref.categoryId);
    const byCategory = categoryId
        ? platformOfRoute(
              {
                  page: 'detail',
                  playlistId: ref.playlistId,
                  kind: ref.kind,
                  categoryId,
              },
              sources.sourceId,
              sources.shelves
          )
        : null;
    if (byCategory) {
        return byCategory;
    }
    const id = Number(ref.itemId);
    return Number.isFinite(id) && id > 0
        ? sources.memberOf(ref.kind, id)
        : null;
}

/** The look a title page and its player take from the platform. */
export function titlePlatformBrand(
    platform: StreamingPlatform
): TitlePlatformBrand {
    return {
        id: platform.id,
        name: platform.name,
        logo: platform.logo,
        logoTone: platform.logoTone,
        ambient: platform.ambient,
    };
}
