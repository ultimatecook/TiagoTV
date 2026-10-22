import type { UnifiedCollectionItem } from '../collection/unified-collection-item.interface';
import {
    clearNavigationStateKeys,
    type WorkspaceNavigationTarget,
} from './workspace-portal-navigation';

/**
 * TiagoTV: navigation-state key of a live channel to play on "En vivo"
 * (`/workspace/countries`). Mi lista's "Canales" cards ask for it; the page
 * plays the channel on its stage when it is one of its countries', else
 * hands it to the Xtream live view.
 */
export const LIVE_CHANNEL_PLAY_STATE_KEY = 'tiagotvLivePlay';

export interface LiveChannelPlayRequest {
    /** The Xtream source the stream belongs to. */
    readonly playlistId: string;
    readonly streamId: number;
    readonly categoryId: string | null;
    readonly title: string;
    readonly icon: string | null;
}

/** "En vivo" playing an Xtream live favourite; null for any other item. */
export function buildLiveChannelPlayTarget(
    item: UnifiedCollectionItem
): WorkspaceNavigationTarget | null {
    const streamId = Number(item.xtreamId);
    if (
        item.contentType !== 'live' ||
        item.sourceType !== 'xtream' ||
        !Number.isInteger(streamId) ||
        streamId <= 0
    ) {
        return null;
    }
    const request: LiveChannelPlayRequest = {
        playlistId: item.playlistId,
        streamId,
        categoryId: item.categoryId == null ? null : String(item.categoryId),
        title: item.name,
        icon: item.logo ?? null,
    };
    return {
        link: ['/workspace', 'countries'],
        state: { [LIVE_CHANNEL_PLAY_STATE_KEY]: request },
    };
}

/** The request a navigation's (or a history entry's) state carries. */
export function readLiveChannelPlayRequest(
    state: unknown
): LiveChannelPlayRequest | null {
    const record =
        state && typeof state === 'object'
            ? (state as Record<string, unknown>)[LIVE_CHANNEL_PLAY_STATE_KEY]
            : null;
    if (!record || typeof record !== 'object') {
        return null;
    }
    const { playlistId, streamId, categoryId, title, icon } = record as Record<
        string,
        unknown
    >;
    const id = Number(streamId);
    return typeof playlistId === 'string' &&
        playlistId &&
        Number.isInteger(id) &&
        id > 0
        ? {
              playlistId,
              streamId: id,
              categoryId:
                  typeof categoryId === 'string' && categoryId
                      ? categoryId
                      : null,
              title: typeof title === 'string' ? title : '',
              icon: typeof icon === 'string' && icon ? icon : null,
          }
        : null;
}

/**
 * Takes the request off the current history entry once acted on: Back or
 * Forward onto "En vivo" opens it on its last channel, as any visit does.
 */
export function clearLiveChannelPlayRequest(): void {
    clearNavigationStateKeys([LIVE_CHANNEL_PLAY_STATE_KEY]);
}
