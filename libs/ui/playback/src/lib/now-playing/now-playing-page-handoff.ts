import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NowPlayingDockService } from './now-playing-dock.service';
import {
    navigationReturnState,
    resolveNowPlayingHandoff,
    type NowPlayingProgress,
    type NowPlayingTeardown,
} from './now-playing-handoff';

/** What a page player describes about its stream when it is torn down. */
export type NowPlayingPageSnapshot = Omit<
    NowPlayingTeardown,
    'dockable' | 'navigatingAway' | 'progress' | 'returnUrl' | 'returnState'
>;

/**
 * A page player's side of the mini-player: it ends the mini-player's
 * session when the page starts its own playback, follows the page's
 * progress, and hands the stream over when a navigation tears the page
 * down mid-playback. Create it in an injection context.
 */
export class NowPlayingPageHandoff {
    private readonly dock = inject(NowPlayingDockService);
    private readonly router = inject(Router, { optional: true });
    /** Where this playback runs, for the mini-player's way back. */
    private readonly originUrl = this.router?.url ?? '';
    private readonly originState = navigationReturnState(
        typeof history !== 'undefined' ? history.state : null
    );
    private progress: NowPlayingProgress | null = null;

    constructor(private readonly dockable: () => boolean) {}

    /** One stream plays at a time: the page's playback ends the bar's. */
    pageStarted(): void {
        if (this.dockable()) {
            this.dock.pagePlaybackStarted();
        }
    }

    /**
     * The page's player must not open its stream yet: the bar's player is
     * still mounted and may hold the connection a one-connection account
     * allows. It unmounts right after `pageStarted()` ended its session.
     */
    waits(): boolean {
        return this.dockable() && this.dock.playerMounted();
    }

    record(progress: NowPlayingProgress): void {
        this.progress = progress;
    }

    release(snapshot: NowPlayingPageSnapshot): void {
        const handoff = resolveNowPlayingHandoff({
            ...snapshot,
            dockable: this.dockable(),
            navigatingAway: this.isNavigatingAway(),
            progress: this.progress,
            returnUrl: this.originUrl,
            returnState: this.originState,
        });
        if (handoff) {
            this.dock.handOff(handoff);
        }
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
            stripQuery(router.url ?? '') !== stripQuery(this.originUrl)
        );
    }
}

function stripQuery(url: string): string {
    return url.split(/[?#]/)[0];
}
