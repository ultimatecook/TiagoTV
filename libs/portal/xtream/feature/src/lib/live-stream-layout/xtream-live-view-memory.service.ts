import type { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import {
    effect,
    inject,
    Injectable,
    Signal,
    signal,
    untracked,
} from '@angular/core';
import { createPlaybackSessionKey } from '@iptvnator/playback/util';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { NowPlayingDockService } from '@iptvnator/ui/playback';
import type { XtreamLiveChannelItem } from './xtream-live-channel-navigation.service';

/**
 * History-state key of what the Xtream live view showed: its channel and
 * how far its channel list was scrolled. Back, Forward or a reload onto the
 * entry bring both back; a way in that asks for a channel wins.
 */
export const XTREAM_LIVE_VIEW_STATE_KEY = 'xtreamLiveView';

export interface XtreamLiveViewMemory {
    readonly playlistId: string;
    readonly channelId: number;
    readonly listOffset?: number;
}

/** A scroll is remembered once it rests this long. */
const SCROLL_REST_MS = 200;
/** The list may still be filling in when it comes back: retry this long. */
const RESTORE_MS = 1500;

export function recallXtreamLiveView(
    state: unknown
): XtreamLiveViewMemory | null {
    const memory =
        state && typeof state === 'object'
            ? (state as Record<string, unknown>)[XTREAM_LIVE_VIEW_STATE_KEY]
            : null;
    if (!memory || typeof memory !== 'object') return null;
    const { playlistId, channelId, listOffset } = memory as Record<
        string,
        unknown
    >;
    if (
        typeof playlistId !== 'string' ||
        !playlistId ||
        typeof channelId !== 'number' ||
        !(channelId > 0)
    ) {
        return null;
    }
    return {
        playlistId,
        channelId,
        ...(typeof listOffset === 'number' && listOffset >= 0
            ? { listOffset }
            : {}),
    };
}

/** Writes onto the current history entry (adding none). */
function rememberXtreamLiveView(memory: XtreamLiveViewMemory): void {
    try {
        const state =
            window.history.state && typeof window.history.state === 'object'
                ? (window.history.state as Record<string, unknown>)
                : {};
        window.history.replaceState(
            { ...state, [XTREAM_LIVE_VIEW_STATE_KEY]: memory },
            document.title
        );
    } catch {
        // A browser that refuses the update keeps nothing.
    }
}

/**
 * The live view's side of Back and Forward: it keeps the channel and the
 * list scroll on the history entry, and brings them back when the page
 * opens on that entry again. The channel plays again only when nothing
 * else plays or the mini-player plays it (the page takes it over); with
 * another page's stream in the mini-player it is only selected.
 */
@Injectable()
export class XtreamLiveViewMemoryService {
    private readonly store = inject(XtreamStore);
    private readonly dock = inject(NowPlayingDockService);
    /** Read as the page opens, before anything of this visit is written. */
    private readonly recalled = recallXtreamLiveView(
        typeof history === 'undefined' ? null : history.state
    );

    /** The played channel goes on the history entry. */
    rememberChannel(channelId: number): void {
        const playlistId = this.store.currentPlaylist()?.id;
        if (!playlistId || !(channelId > 0)) return;
        const current = recallXtreamLiveView(window.history.state);
        rememberXtreamLiveView({
            playlistId,
            channelId,
            ...(current?.playlistId === playlistId &&
            current.channelId === channelId &&
            current.listOffset !== undefined
                ? { listOffset: current.listOffset }
                : {}),
        });
    }

    /** Must be called in an injection context (the page's constructor). */
    connect(options: {
        /** A channel the way in asked for (it wins over the memory). */
        readonly pendingItemId: Signal<number | null>;
        readonly channels: () => readonly XtreamLiveChannelItem[];
        /** Selects, and with `play` plays, the remembered channel. */
        readonly open: (item: XtreamLiveChannelItem, play: boolean) => void;
        readonly listViewport: Signal<CdkVirtualScrollViewport | undefined>;
    }): void {
        let pending = this.recalled;
        const restoreRequest = signal<{ readonly offset: number } | null>(
            null
        );
        let applied: object | null = null;
        effect(() => {
            if (!pending) return;
            if (options.pendingItemId() !== null) {
                pending = null;
                return;
            }
            const memory = pending;
            if (
                this.store.selectedContentType() !== 'live' ||
                this.store.currentPlaylist()?.id !== memory.playlistId
            ) {
                return;
            }
            const item = options
                .channels()
                .find((channel) => Number(channel.xtream_id) === memory.channelId);
            if (!item) {
                if (this.store.isContentInitialized()) pending = null;
                return;
            }
            pending = null;
            if (memory.listOffset !== undefined) {
                restoreRequest.set({ offset: memory.listOffset });
            }
            const docked = this.dock.session()?.sessionKey;
            const own = createPlaybackSessionKey({
                kind: 'live',
                sourceId: memory.playlistId,
                contentId: memory.channelId,
            });
            untracked(() => options.open(item, !docked || docked === own));
        });

        effect((onCleanup) => {
            const viewport = options.listViewport();
            const request = restoreRequest();
            if (!viewport) return;
            if (request && request !== applied) {
                applied = request;
                onCleanup(restoreListOffset(viewport, request.offset));
            }
            onCleanup(this.followListOffset(viewport));
        });
    }

    /** Remembers where the list rests; a traversal cancels a pending write. */
    private followListOffset(viewport: CdkVirtualScrollViewport): () => void {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const cancel = () => {
            if (timer !== null) clearTimeout(timer);
            timer = null;
        };
        const subscription = viewport.elementScrolled().subscribe(() => {
            cancel();
            timer = setTimeout(() => {
                timer = null;
                const memory = recallXtreamLiveView(window.history.state);
                if (
                    memory &&
                    memory.playlistId === this.store.currentPlaylist()?.id
                ) {
                    rememberXtreamLiveView({
                        ...memory,
                        listOffset: Math.round(viewport.measureScrollOffset()),
                    });
                }
            }, SCROLL_REST_MS);
        });
        window.addEventListener('popstate', cancel);
        const stop = () => {
            cancel();
            subscription.unsubscribe();
            window.removeEventListener('popstate', cancel);
        };
        return stop;
    }
}

/** Scrolls the list back once it is long enough; the user's wheel wins. */
function restoreListOffset(
    viewport: CdkVirtualScrollViewport,
    offset: number
): () => void {
    const element = viewport.elementRef.nativeElement;
    const view = element.ownerDocument.defaultView;
    if (!view) return () => undefined;
    const started = view.performance.now();
    let frame = 0;
    const attempt = () => {
        viewport.checkViewportSize();
        viewport.scrollToOffset(offset);
        if (
            Math.abs(viewport.measureScrollOffset() - offset) >= 2 &&
            view.performance.now() - started < RESTORE_MS
        ) {
            frame = view.requestAnimationFrame(attempt);
        }
    };
    frame = view.requestAnimationFrame(attempt);
    const stop = () => view.cancelAnimationFrame(frame);
    element.addEventListener('wheel', stop, { once: true, passive: true });
    return () => {
        stop();
        element.removeEventListener('wheel', stop);
    };
}
