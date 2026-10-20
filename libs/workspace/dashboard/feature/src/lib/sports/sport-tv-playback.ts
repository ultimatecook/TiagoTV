import {
    computed,
    DestroyRef,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
} from '@angular/core';
import { UnifiedRecentDataService } from '@iptvnator/portal/shared/data-access';
import {
    buildXtreamCollectionUid,
    PORTAL_PLAYER,
    type UnifiedCollectionItem,
} from '@iptvnator/portal/shared/util';
import {
    XtreamStore,
    XtreamUrlService,
    type XtreamCredentials,
} from '@iptvnator/portal/xtream/data-access';
import { PlaybackHistoryGate } from '@iptvnator/playback/data-access';
import { createPlaybackSessionKey } from '@iptvnator/playback/util';
import { ParentalLockService } from '@iptvnator/services';
import type {
    PlaylistMeta,
    ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import {
    NowPlayingDockService,
    type PlaybackFallbackRequest,
} from '@iptvnator/ui/playback';
import type { SportChannel } from './sports-catalog';
import { SportsCatalogService } from './sports-catalog.service';

/**
 * The player of a competition's page, built the way the Xtream live view
 * (and "Por países") builds a channel's playback: `XtreamUrlService` with
 * the source's credentials and the stream format setting (MPEG-TS by
 * default), the Auto TS fallback when the account's formats are known,
 * the source's headers, and the live view's session key. The web player
 * does the rest: one stream connection at a time, the stuck-start
 * retries, and the hand-over to the bottom mini-player when the page is
 * left.
 *
 * Component-provided: it lives as long as the page.
 */
@Injectable()
export class SportTvPlayback {
    private readonly sports = inject(SportsCatalogService);
    private readonly urls = inject(XtreamUrlService);
    private readonly xtreamStore = inject(XtreamStore);
    private readonly portalPlayer = inject(PORTAL_PLAYER);
    private readonly historyGate = inject(PlaybackHistoryGate);
    private readonly recent = inject(UnifiedRecentDataService);
    private readonly parentalLock = inject(ParentalLockService);
    private readonly dock = inject(NowPlayingDockService);

    /** The channel on the stage: playing, or waiting for Play. */
    readonly selection = signal<SportChannel | null>(null);
    /** What the stage's player plays; null while it waits. */
    readonly playback = signal<ResolvedPortalPlayback | null>(null);
    /** The page is leaving for the live view: no hand-over to the mini-player. */
    readonly leaving = signal(false);
    /** Inline (web engines, Embedded MPV), or launched in MPV/VLC. */
    readonly embedded = computed(() => this.portalPlayer.isEmbeddedPlayer());
    readonly sessionKey = computed(() => this.keyOf(this.selection()));

    constructor() {
        // A relock (idle timer, Lock now) stops a channel of a category it
        // withholds, as the live view does.
        effect(() => {
            this.parentalLock.version();
            untracked(() => this.stopIfLocked());
        });
        inject(DestroyRef).onDestroy(() => this.playback.set(null));
    }

    /**
     * The page's opening channel: it plays at once unless the mini-player
     * is playing something from another page, which it would end. A
     * channel the way in asked for (`requested`), or the one the
     * mini-player is playing, plays anyway: the page takes the stream over
     * (the mini-player stops first, one connection).
     */
    open(channel: SportChannel, requested = false): void {
        const session = this.dock.session();
        const fromHere = session?.returnUrl.startsWith('/workspace/sports');
        const docked = !!session && session.sessionKey === this.keyOf(channel);
        if (this.embedded() && (!session || fromHere || requested || docked)) {
            this.play(channel);
        } else {
            this.selection.set(channel);
        }
    }

    /** The mini-player's channel, when it is one of `channels`. */
    dockedChannel(channels: readonly SportChannel[]): SportChannel | null {
        const key = this.dock.session()?.sessionKey;
        return key
            ? (channels.find((channel) => this.keyOf(channel) === key) ?? null)
            : null;
    }

    /** A channel picked on the page. */
    play(channel: SportChannel): void {
        const source = this.sports.source();
        const playing = this.playback() ? this.selection() : null;
        // The playing channel again: it keeps playing (the player has Retry).
        if (!source || playing?.streamId === channel.streamId) {
            return;
        }
        const playback = buildSportPlayback(
            source,
            channel,
            this.urls,
            this.allowedFormats(source)
        );
        if (!playback.streamUrl) {
            return;
        }
        this.selection.set(channel);
        const inline = this.embedded();
        this.playback.set(inline ? playback : null);
        if (!inline) {
            // MPV/VLC opens a stream of its own: the mini-player's goes first.
            this.dock.close();
            void this.portalPlayer.openResolvedPlayback(playback);
        }
        // Picking is not watching: the channel joins Recently viewed once
        // its stream has really played.
        const item = recentItem(source, channel);
        this.historyGate.defer(
            {
                sessionKey: inline ? this.sessionKey() : null,
                streamUrls: [playback.streamUrl],
            },
            () => void this.recent.recordLivePlayback(item).catch(() => null)
        );
    }

    /** Recovery's "Open in MPV/VLC" after an inline failure. */
    openExternally(request: PlaybackFallbackRequest): void {
        const launch = this.portalPlayer.openExternalPlayback(
            request.playback,
            request.player
        );
        request.trackLaunch(launch);
    }

    stop(): void {
        this.playback.set(null);
    }

    /** Nothing on the stage: no channel, no stream. */
    clear(): void {
        this.playback.set(null);
        this.selection.set(null);
    }

    /** The live view's session key for `channel` on the current source. */
    private keyOf(channel: SportChannel | null): string {
        const source = this.sports.source();
        return source && channel
            ? createPlaybackSessionKey({
                  kind: 'live',
                  sourceId: source._id,
                  contentId: channel.streamId,
              })
            : '';
    }

    /** The account's formats, known once the live view asked for them. */
    private allowedFormats(source: PlaylistMeta): string[] | undefined {
        const current = this.xtreamStore.currentPlaylist();
        return current?.id === source._id
            ? current.allowedOutputFormats
            : undefined;
    }

    private stopIfLocked(): void {
        const source = this.sports.source();
        const channel = this.selection();
        if (
            source &&
            channel &&
            this.parentalLock.isXtreamCategoryLocked(
                source._id,
                'live',
                Number(channel.categoryId)
            )
        ) {
            this.stop();
        }
    }
}

export function buildSportPlayback(
    source: PlaylistMeta,
    channel: SportChannel,
    urls: Pick<XtreamUrlService, 'constructLiveUrl' | 'constructAutoLiveTsUrl'>,
    allowedOutputFormats?: string[]
): ResolvedPortalPlayback {
    const credentials: XtreamCredentials = {
        serverUrl: source.serverUrl ?? '',
        username: source.username ?? '',
        password: source.password ?? '',
        allowedOutputFormats,
    };
    return {
        streamUrl: urls.constructLiveUrl(credentials, channel.streamId),
        liveAutoTsUrl: urls.constructAutoLiveTsUrl(
            credentials,
            channel.streamId
        ),
        userAgent: source.userAgent,
        referer: source.referrer,
        origin: source.origin,
        title: channel.title,
        thumbnail: channel.icon,
        isLive: true,
    };
}

function recentItem(
    source: PlaylistMeta,
    channel: SportChannel
): UnifiedCollectionItem {
    return {
        uid: buildXtreamCollectionUid(source._id, 'live', channel.streamId),
        name: channel.title,
        contentType: 'live',
        sourceType: 'xtream',
        playlistId: source._id,
        playlistName: source.title ?? '',
        logo: channel.icon,
        xtreamId: channel.streamId,
        categoryId: channel.categoryId,
    };
}
