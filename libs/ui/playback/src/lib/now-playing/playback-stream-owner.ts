import { Injectable, signal } from '@angular/core';

/**
 * A close that never answers (a hung main process) must not hold every
 * later stream back for good: after this long it counts as closed.
 */
const CLOSE_WAIT_LIMIT_MS = 5000;

/** A player that can hold the app's stream connection. */
export interface PlaybackStreamHolder {
    /** Another player is starting: stop, and close this one's connection. */
    stop(): void;
}

/**
 * The app's one stream connection. Providers often allow one connection,
 * and refuse or stall a second, so every inline player holds its stream
 * through here: a page's web player (Embedded MPV included) and the bottom
 * mini-player.
 *
 * - `claim()`: a player is about to open a stream. Every other holder is
 *   stopped; it lets go with `release()` once its engine (and connection)
 *   is gone.
 * - `blocked()`: the claimant waits while another holder has not let go,
 *   or while a connection still closes asynchronously (`closing()`, the
 *   Embedded MPV dispose round trip to the main process).
 * - `whenClosed()`: Embedded MPV creates its next native session only after
 *   the previous ones are disposed.
 */
@Injectable({ providedIn: 'root' })
export class PlaybackStreamOwner {
    private readonly holders = signal<readonly PlaybackStreamHolder[]>([]);
    private readonly pendingCloses = signal(0);
    private closedWaiters: (() => void)[] = [];

    /** `holder` opens a stream next: every other holder stops first. */
    claim(holder: PlaybackStreamHolder): void {
        const current = this.holders();
        const others = current.filter((entry) => entry !== holder);
        if (others.length === current.length) {
            this.holders.set([...current, holder]);
        }
        for (const other of others) {
            other.stop();
        }
    }

    /**
     * `holder` may hold a connection, but takes it from nobody: the others
     * wait until it lets go.
     */
    hold(holder: PlaybackStreamHolder): void {
        if (!this.holders().includes(holder)) {
            this.holders.update((list) => [...list, holder]);
        }
    }

    /** `holder`'s engine is gone: its connection is closed (or closing). */
    release(holder: PlaybackStreamHolder): void {
        if (this.holders().includes(holder)) {
            this.holders.update((list) =>
                list.filter((entry) => entry !== holder)
            );
        }
    }

    /** A connection that is closed once `closed` settles. */
    closing(closed: Promise<unknown>): void {
        this.pendingCloses.update((count) => count + 1);
        let settled = false;
        const limit = setTimeout(() => settle(), CLOSE_WAIT_LIMIT_MS);
        const settle = () => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(limit);
            this.pendingCloses.update((count) => count - 1);
            if (this.pendingCloses() === 0) {
                const waiters = this.closedWaiters;
                this.closedWaiters = [];
                waiters.forEach((resolve) => resolve());
            }
        };
        closed.then(settle, settle);
    }

    /**
     * Whether `holder` must not open its stream yet: another holder has not
     * let go, or (with `closes`) a connection is still closing.
     */
    blocked(holder: PlaybackStreamHolder, closes = true): boolean {
        return (
            (closes && this.pendingCloses() > 0) ||
            this.holders().some((entry) => entry !== holder)
        );
    }

    /** Resolves once no connection is closing any more. */
    whenClosed(): Promise<void> {
        if (this.pendingCloses() === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => this.closedWaiters.push(resolve));
    }
}
