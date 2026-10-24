import type { UnifiedCollectionItem } from '../collection/unified-collection-item.interface';
import {
    clearNavigationStateKeys,
    type WorkspaceNavigationTarget,
} from './workspace-portal-navigation';

/**
 * TiagoTV: navigation-state key of a live channel to play on "En vivo"
 * (`/workspace/countries`). The redesign's ways in to a channel ask for it
 * (Mi lista's and Recently viewed's "Canales" cards, the Home's last
 * channels and live hero, Buscar's channels); the page plays the channel
 * on its stage when it is one of its countries', else hands it to the
 * Xtream live view.
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

/** A live channel as a way in to "En vivo" knows it. */
export interface LiveChannelPlaySource {
    /** `xtream`, `stalker` or `m3u`: only an Xtream channel plays there. */
    readonly sourceType: string | null | undefined;
    readonly playlistId: string;
    /** The Xtream stream id, as stored (a number or its digits). */
    readonly streamId: unknown;
    readonly categoryId?: string | number | null;
    readonly title: string;
    readonly icon?: string | null;
}

/**
 * "En vivo" playing an Xtream live channel; null for another source's,
 * which keeps its own way in (En vivo shows the Xtream line-up only).
 */
export function buildLiveChannelPlayTargetFor(
    channel: LiveChannelPlaySource
): WorkspaceNavigationTarget | null {
    const streamId = Number(channel.streamId);
    if (
        channel.sourceType !== 'xtream' ||
        !channel.playlistId ||
        channel.streamId == null ||
        channel.streamId === '' ||
        !Number.isInteger(streamId) ||
        streamId <= 0
    ) {
        return null;
    }
    const categoryId =
        channel.categoryId == null || channel.categoryId === ''
            ? null
            : String(channel.categoryId);
    const request: LiveChannelPlayRequest = {
        playlistId: channel.playlistId,
        streamId,
        categoryId,
        title: channel.title,
        icon: channel.icon || null,
    };
    return {
        link: ['/workspace', 'countries'],
        state: { [LIVE_CHANNEL_PLAY_STATE_KEY]: request },
    };
}

/** "En vivo" playing an Xtream live collection row; null for any other. */
export function buildLiveChannelPlayTarget(
    item: UnifiedCollectionItem
): WorkspaceNavigationTarget | null {
    return item.contentType === 'live'
        ? buildLiveChannelPlayTargetFor({
              sourceType: item.sourceType,
              playlistId: item.playlistId,
              streamId: item.xtreamId,
              categoryId: item.categoryId,
              title: item.name,
              icon: item.logo,
          })
        : null;
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
