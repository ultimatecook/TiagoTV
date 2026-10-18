import { Injectable, signal } from '@angular/core';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';

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
    private readonly sessionState = signal<NowPlayingSession | null>(null);
    private nextId = 1;

    readonly session = this.sessionState.asReadonly();

    handOff(handoff: NowPlayingHandoff): void {
        this.sessionState.set({ ...handoff, id: this.nextId++ });
    }

    /** A page mounted its own player: the bar stops. */
    pagePlaybackStarted(): void {
        this.close();
    }

    close(): void {
        if (this.sessionState() !== null) {
            this.sessionState.set(null);
        }
    }
}
