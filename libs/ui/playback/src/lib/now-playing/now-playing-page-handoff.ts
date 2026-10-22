import {
    afterNextRender,
    DestroyRef,
    effect,
    inject,
    Injector,
    signal,
    untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { NowPlayingDockService } from './now-playing-dock.service';
import {
    navigationReturnState,
    resolveNowPlayingHandoff,
    type NowPlayingProgress,
    type NowPlayingTeardown,
} from './now-playing-handoff';
import {
    PlaybackStreamOwner,
    type PlaybackStreamHolder,
} from './playback-stream-owner';

const PIP_EVENTS = ['enterpictureinpicture', 'leavepictureinpicture'];

/** What a page player describes about its stream when it is torn down. */
export type NowPlayingPageSnapshot = Omit<
    NowPlayingTeardown,
    | 'dockable'
    | 'navigatingAway'
    | 'progress'
    | 'returnUrl'
    | 'returnState'
    | 'pictureInPicture'
>;

/**
 * A page player's side of the app's one stream and of the mini-player: the
 * page's playback claims the stream (ending the mini-player's session and
 * stopping any other player), waits until the previous connection is
 * closed, follows the page's progress, and hands the stream over when a
 * navigation tears the page down mid-playback. Create it in an injection
 * context.
 */
export class NowPlayingPageHandoff {
    private readonly dock = inject(NowPlayingDockService);
    private readonly streams = inject(PlaybackStreamOwner);
    private readonly injector = inject(Injector);
    private readonly router = inject(Router, { optional: true });
    /** Where this playback runs, for the mini-player's way back. */
    private readonly originUrl = this.router?.url ?? '';
    private readonly originState = navigationReturnState(
        typeof history !== 'undefined' ? history.state : null
    );
    /** The history entry it runs on; null without the Navigation API. */
    private readonly originEntryKey = currentHistoryEntryKey();
    private progress: NowPlayingProgress | null = null;
    /**
     * The page's picture is in picture-in-picture. One stream plays at a
     * time, so a PiP video while this page plays is its own; the engine's
     * teardown exits PiP asynchronously, after the hand-over read this.
     */
    private pictureInPicture = false;
    private readonly onPictureInPicture = (event: Event) => {
        this.pictureInPicture = event.type === 'enterpictureinpicture';
    };
    private readonly stoppedState = signal(false);
    private readonly holder: PlaybackStreamHolder = {
        stop: () => this.stopForAnotherPlayer(),
    };
    /** Another player took the stream: this one renders no engine. */
    readonly stopped = this.stoppedState.asReadonly();

    /**
     * @param dockable whether a navigation away hands the stream to the
     *   mini-player (not for Embedded MPV, nor a page that is leaving for a
     *   player of its own).
     * @param inMiniPlayer the mini-player's own view: the bar holds the
     *   stream for it, so it neither claims nor waits.
     * @param request what the page asks the player to play: once another
     *   player stopped this one, a new request claims the stream back. Its
     *   own retries and reloads keep the request and never take it back.
     */
    constructor(
        private readonly dockable: () => boolean,
        private readonly inMiniPlayer: () => boolean = () => false,
        request: () => unknown = () => null
    ) {
        effect(() => {
            request();
            untracked(() => {
                if (this.stoppedState()) {
                    this.pageStarted();
                }
            });
        });
        if (typeof document !== 'undefined') {
            for (const type of PIP_EVENTS) {
                document.addEventListener(type, this.onPictureInPicture, true);
            }
            inject(DestroyRef).onDestroy(() => {
                for (const type of PIP_EVENTS) {
                    document.removeEventListener(
                        type,
                        this.onPictureInPicture,
                        true
                    );
                }
            });
        }
    }

    /**
     * One stream plays at a time: the page's playback ends the bar's, and
     * any other player's, whatever engine either one plays on.
     */
    pageStarted(): void {
        if (this.inMiniPlayer()) {
            return;
        }
        this.stoppedState.set(false);
        this.streams.claim(this.holder);
        this.dock.pagePlaybackStarted();
    }

    /**
     * The page's player must not open its stream yet: the bar's player (or
     * another one) is still mounted and may hold the connection a
     * one-connection account allows, or (with `closes`) an Embedded MPV
     * session is still being disposed. They let go right after
     * `pageStarted()` stopped them.
     */
    waits(closes = true): boolean {
        return (
            !this.inMiniPlayer() && this.streams.blocked(this.holder, closes)
        );
    }

    record(progress: NowPlayingProgress): void {
        this.progress = progress;
    }

    release(snapshot: NowPlayingPageSnapshot): void {
        // Its engine (a child) is already gone, with its connection.
        this.streams.release(this.holder);
        const handoff = resolveNowPlayingHandoff({
            ...snapshot,
            dockable: this.dockable(),
            navigatingAway: this.isNavigatingAway(),
            progress: this.progress,
            returnUrl: this.originUrl,
            returnState: this.originState,
            pictureInPicture: this.pictureInPicture,
        });
        if (handoff) {
            this.dock.handOff(handoff);
        }
    }

    /**
     * Another player claimed the stream while this page's is still
     * mounted: its engine unmounts (closing the connection), and once that
     * rendered, the stream is let go.
     */
    private stopForAnotherPlayer(): void {
        this.stoppedState.set(true);
        afterNextRender(() => this.streams.release(this.holder), {
            injector: this.injector,
        });
    }

    /**
     * The player is going away with its page, not because the page closed
     * it: a navigation is under way, or already moved the URL.
     */
    private isNavigatingAway(): boolean {
        const router = this.router;
        if (!router) {
            return false;
        }
        // Hosts' specs stub the router; a stub without the signal or URL
        // simply never hands over.
        const navigation =
            typeof router.currentNavigation === 'function'
                ? router.currentNavigation()
                : null;
        return (
            navigation !== null ||
            stripQuery(router.url ?? '') !== stripQuery(this.originUrl) ||
            // A traversal that keeps the URL leaves the page all the same:
            // Back from a collection's inline detail (Mi lista) to its list.
            // A `replaceState` keeps the entry's key.
            (this.originEntryKey !== null &&
                currentHistoryEntryKey() !== this.originEntryKey)
        );
    }
}

function stripQuery(url: string): string {
    return url.split(/[?#]/)[0];
}

function currentHistoryEntryKey(): string | null {
    try {
        return typeof navigation === 'undefined'
            ? null
            : (navigation?.currentEntry?.key ?? null);
    } catch {
        return null;
    }
}
