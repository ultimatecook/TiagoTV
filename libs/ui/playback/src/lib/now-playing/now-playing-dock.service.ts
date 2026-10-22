import { computed, inject, Injectable, signal } from '@angular/core';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';
import { PlaybackStreamOwner } from './playback-stream-owner';

/** A playback the mini-player continues once the page that ran it is gone. */
export interface NowPlayingHandoff {
    /** The playback session it continues (history and resume keys). */
    readonly sessionKey: string;
    readonly streamUrl: string;
    readonly playback: ResolvedPortalPlayback | null;
    readonly title: string;
    /** Episode label or programme, under the title. */
    readonly subtitle: string | null;
    readonly artworkUrl: string | null;
    /** Seconds into the stream when the page let go of it. */
    readonly startTime: number;
    /** Seconds; 0 when unknown (live, or metadata never arrived). */
    readonly duration: number;
    readonly isLive: boolean;
    readonly paused: boolean;
    /** 0–1, the volume the page's player was at. */
    readonly volume: number;
    readonly muted: boolean;
    /** The page the playback came from; the bar's artwork returns there. */
    readonly returnUrl: string;
    readonly returnState: Record<string, unknown> | null;
    /**
     * The page's picture was in picture-in-picture: the bar's player asks
     * for it again (the browser allows it while the leaving click's user
     * activation lasts, else the bar's PiP button does it).
     */
    readonly pictureInPicture?: boolean;
}

export interface NowPlayingSession extends NowPlayingHandoff {
    /** Distinct per handoff, so the bar remounts its player for each one. */
    readonly id: number;
}

/**
 * The bottom mini-player's one session. A page's web player hands its
 * stream over when the user navigates away mid-playback; the shell's bar
 * keeps it playing while the user browses. One stream plays at a time: a
 * page starting its own playback ends the session.
 */
@Injectable({ providedIn: 'root' })
export class NowPlayingDockService {
    private readonly streams = inject(PlaybackStreamOwner);
    private readonly sessionState = signal<NowPlayingSession | null>(null);
    private readonly expandedState = signal(false);
    private readonly mountedPlayers = signal(0);
    private nextId = 1;

    readonly session = this.sessionState.asReadonly();
    /**
     * The session opened as the full-window player. The bar grows in place,
     * so the stream keeps playing; the shell makes the rest inert.
     */
    readonly expanded = this.expandedState.asReadonly();
    /**
     * The bar's player is still mounted, so its stream may still be open.
     * It outlives `session` by a render: the bar unmounts after the session
     * ends, and its player closes the connection as it does.
     */
    readonly playerMounted = computed(() => this.mountedPlayers() > 0);

    /**
     * The bar mounted its player, which now holds the app's one stream
     * (any other player is stopped); the returned call reports it gone.
     * `stop` ends the bar's session when another player claims the stream.
     * A bar mounted for a session a page already ended (in the same
     * render) takes the stream from nobody: that page waits for it.
     */
    registerPlayer(stop: () => void = () => this.close()): () => void {
        const holder = { stop };
        this.mountedPlayers.update((count) => count + 1);
        if (this.sessionState() !== null) {
            this.streams.claim(holder);
        } else {
            this.streams.hold(holder);
        }
        let registered = true;
        return () => {
            if (registered) {
                registered = false;
                this.mountedPlayers.update((count) => count - 1);
                this.streams.release(holder);
            }
        };
    }

    handOff(handoff: NowPlayingHandoff): void {
        this.expandedState.set(false);
        this.sessionState.set({ ...handoff, id: this.nextId++ });
    }

    expand(): void {
        this.expandedState.set(this.sessionState() !== null);
    }

    collapse(): void {
        this.expandedState.set(false);
    }

    /** A page mounted its own player: the bar stops. */
    pagePlaybackStarted(): void {
        this.close();
    }

    close(): void {
        this.expandedState.set(false);
        if (this.sessionState() !== null) {
            this.sessionState.set(null);
        }
    }
}
