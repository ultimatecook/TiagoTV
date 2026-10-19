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
import { SportsCatalogService } from '../sports/sports-catalog.service';
import type { CountryChannel } from './country-channels';
import {
    browserStorage,
    rememberSelection,
    type TvSelection,
} from './country-tv-start';

/**
 * The player of "En vivo", built the way the Xtream live view builds a
 * channel's playback: `XtreamUrlService` with the source's credentials and
 * the stream format setting (MPEG-TS by default), the Auto TS fallback when
 * the account's formats are known, the source's headers, and the live
 * view's session key. The web player does the rest: one stream connection
 * at a time, the stuck-start retries, and the hand-over to the bottom
 * mini-player when the page is left.
 *
 * Component-provided: it lives as long as the page.
 */
@Injectable()
export class CountryTvPlayback {
    private readonly sports = inject(SportsCatalogService);
    private readonly urls = inject(XtreamUrlService);
    private readonly xtreamStore = inject(XtreamStore);
    private readonly portalPlayer = inject(PORTAL_PLAYER);
    private readonly historyGate = inject(PlaybackHistoryGate);
    private readonly recent = inject(UnifiedRecentDataService);
    private readonly parentalLock = inject(ParentalLockService);
    private readonly dock = inject(NowPlayingDockService);

    /** The channel on the stage: playing, or waiting for Play. */
    readonly selection = signal<TvSelection | null>(null);
    /** What the stage's player plays; null while it waits. */
    readonly playback = signal<ResolvedPortalPlayback | null>(null);
    /**
     * The page is leaving for the live view, which plays the channel next:
     * the player does not hand its stream to the mini-player.
     */
    readonly leaving = signal(false);
    /** Inline (web engines, Embedded MPV), or launched in MPV/VLC. */
    readonly embedded = computed(() => this.portalPlayer.isEmbeddedPlayer());
    readonly sessionKey = computed(() => {
        const source = this.sports.source();
        const copy = this.selection()?.copy;
        return source && copy
            ? createPlaybackSessionKey({
                  kind: 'live',
                  sourceId: source._id,
                  contentId: copy.streamId,
              })
            : '';
    });

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
     * is playing something from another page, which it would end.
     */
    open(selection: TvSelection): void {
        const session = this.dock.session();
        const fromHere = session?.returnUrl.startsWith('/workspace/countries');
        if (this.embedded() && (!session || fromHere)) {
            this.play(selection);
        } else {
            this.selection.set(selection);
        }
    }

    /** A channel picked on the page, or its other copy. */
    play(selection: TvSelection): void {
        const source = this.sports.source();
        const playing = this.playback() ? this.selection()?.copy : null;
        // The playing tile again: it keeps playing (the player has Retry).
        if (!source || playing?.streamId === selection.copy.streamId) {
            return;
        }
        const playback = buildTvPlayback(
            source,
            selection.copy,
            selection.channel.title,
            this.urls,
            this.allowedFormats(source)
        );
        if (!playback.streamUrl) {
            return;
        }
        this.selection.set(selection);
        rememberSelection(browserStorage(), selection);
        const inline = this.embedded();
        this.playback.set(inline ? playback : null);
        if (!inline) {
            void this.portalPlayer.openResolvedPlayback(playback);
        }
        // Picking is not watching: the channel joins Recently viewed once
        // its stream has really played.
        const item = recentItem(source, selection);
        this.historyGate.defer(
            {
                sessionKey: inline ? this.sessionKey() : null,
                streamUrls: [playback.streamUrl],
            },
            () => void this.recent.recordLivePlayback(item).catch(() => null)
        );
    }

    playCopy(copy: CountryChannel): void {
        const selection = this.selection();
        if (selection && copy.streamId !== selection.copy.streamId) {
            this.play({ ...selection, copy });
        }
    }

    /**
     * "Open in Live TV": the channel in the Xtream live view, which plays
     * it next, so the page hands nothing to the mini-player.
     */
    openLiveView(): void {
        const selection = this.selection();
        if (!selection) {
            return;
        }
        this.leaving.set(true);
        const { copy, channel } = selection;
        this.sports.play({
            streamId: copy.streamId,
            categoryId: copy.categoryId,
            title: channel.title,
            icon: copy.icon,
        });
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

    /** The account's formats, known once the live view asked for them. */
    private allowedFormats(source: PlaylistMeta): string[] | undefined {
        const current = this.xtreamStore.currentPlaylist();
        return current?.id === source._id
            ? current.allowedOutputFormats
            : undefined;
    }

    private stopIfLocked(): void {
        const source = this.sports.source();
        const copy = this.selection()?.copy;
        if (
            source &&
            copy &&
            this.parentalLock.isXtreamCategoryLocked(
                source._id,
                'live',
                Number(copy.categoryId)
            )
        ) {
            this.stop();
        }
    }
}

export function buildTvPlayback(
    source: PlaylistMeta,
    copy: CountryChannel,
    title: string,
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
        streamUrl: urls.constructLiveUrl(credentials, copy.streamId),
        liveAutoTsUrl: urls.constructAutoLiveTsUrl(credentials, copy.streamId),
        userAgent: source.userAgent,
        referer: source.referrer,
        origin: source.origin,
        title,
        thumbnail: copy.icon,
        isLive: true,
    };
}

function recentItem(
    source: PlaylistMeta,
    selection: TvSelection
): UnifiedCollectionItem {
    const { copy, channel } = selection;
    return {
        uid: buildXtreamCollectionUid(source._id, 'live', copy.streamId),
        name: channel.title,
        contentType: 'live',
        sourceType: 'xtream',
        playlistId: source._id,
        playlistName: source.title ?? '',
        logo: copy.icon ?? channel.icons[0] ?? null,
        xtreamId: copy.streamId,
        categoryId: copy.categoryId,
    };
}
