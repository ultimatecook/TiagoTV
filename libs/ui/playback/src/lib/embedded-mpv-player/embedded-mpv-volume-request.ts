import {
    DestroyRef,
    effect,
    inject,
    type Signal,
    signal,
    untracked,
} from '@angular/core';
import type { EmbeddedMpvSession } from '@iptvnator/shared/interfaces';
import { readStoredVolume } from './embedded-mpv-format.utils';

/** How long an unconfirmed level outranks the session's report. */
export const EMBEDDED_MPV_VOLUME_HOLD_MS = 1500;

/** Closer than this, the session reports the level that was asked for. */
const SAME_LEVEL = 0.005;

interface VolumeRequest {
    readonly value: number;
    readonly sessionId: string | null;
}

export interface EmbeddedMpvVolumeTarget {
    readonly session: Signal<EmbeddedMpvSession | null>;
    applyVolume(value: number): Promise<void>;
}

/**
 * The shared controls' volume for Embedded MPV: applies a level and reports
 * it until the session does. Embedded MPV confirms a level late: the
 * frame-copy helper sends its state at most every 250 ms, the main process
 * polls it every 500 ms, and a command's own reply carries the level from
 * before the command. Reported as is, those late levels reached the
 * controls as changes: the slider snapped back while it was dragged and
 * after it was let go, and after a mute and an unmute the button showed the
 * player muted while it played (its next click "unmuted" it). A request the
 * session never confirms (a refused command) gives way to the session's
 * level after {@link EMBEDDED_MPV_VOLUME_HOLD_MS}. Create it in an
 * injection context.
 */
export class EmbeddedMpvVolumeRequest {
    private readonly requested = signal<VolumeRequest | null>(null);
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly target: EmbeddedMpvVolumeTarget) {
        effect(() => {
            const session = target.session();
            untracked(() => this.settle(session));
        });
        inject(DestroyRef).onDestroy(() => this.clearTimer());
    }

    /** Asks the session for `value` (0–1). */
    apply(value: number): void {
        this.clearTimer();
        const sessionId = untracked(() => this.target.session()?.id ?? null);
        this.requested.set({ value, sessionId });
        this.timer = setTimeout(() => {
            this.timer = null;
            this.requested.set(null);
        }, EMBEDDED_MPV_VOLUME_HOLD_MS);
        void this.target.applyVolume(value);
    }

    /** The level the controls show for `session`. */
    level(session: EmbeddedMpvSession | null): number {
        const request = this.requested();
        if (request && request.sessionId === (session?.id ?? null)) {
            return request.value;
        }
        return session?.volume ?? readStoredVolume();
    }

    private settle(session: EmbeddedMpvSession | null): void {
        const request = this.requested();
        if (
            request &&
            session &&
            request.sessionId === session.id &&
            Math.abs(session.volume - request.value) < SAME_LEVEL
        ) {
            this.clearTimer();
            this.requested.set(null);
        }
    }

    private clearTimer(): void {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
