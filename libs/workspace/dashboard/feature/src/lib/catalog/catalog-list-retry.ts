import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { CatalogStreamActivity } from './catalog-stream-activity';

/**
 * A list still missing after its quick second try is tried again this much
 * later, then later still (the last delay repeats).
 */
export const CATALOG_RETRY_DELAYS_MS: readonly number[] = [2, 5, 15, 30].map(
    (minutes) => minutes * 60_000
);
/** Once playback stops, its connection may still be closing. */
export const CATALOG_RETRY_AFTER_PLAYBACK_MS = 3_000;
/** An empty answer is asked again this many times, then believed. */
const EMPTY_TRIES = 3;

/** How a retried request went. */
export type CatalogRetryOutcome = 'ok' | 'empty' | 'failed';

interface Pending {
    readonly retry: () => Promise<CatalogRetryOutcome>;
    readonly tries: number;
}

/**
 * The platforms' lists that failed, tried again later: when playback stops
 * (the provider allows one connection, and may refuse its API while a
 * stream holds it) and on a timer that backs off. One at a time, in the
 * order they failed; a refusal leaves the rest for the next round.
 */
@Injectable({ providedIn: 'root' })
export class CatalogListRetry {
    private readonly tasks = new Map<string, Pending>();
    private readonly count = signal(0);
    private timer: ReturnType<typeof setTimeout> | null = null;
    private round = 0;
    private running: Promise<void> | null = null;

    /** How many lists wait to be tried again. */
    readonly pending = this.count.asReadonly();

    constructor() {
        const stop = inject(CatalogStreamActivity).onStop(() => {
            if (this.tasks.size > 0) {
                this.round = 0;
                this.wait(CATALOG_RETRY_AFTER_PLAYBACK_MS);
            }
        });
        inject(DestroyRef).onDestroy(() => {
            stop();
            this.clear();
        });
    }

    /** Tries `retry` again later, unless it already waits. */
    add(key: string, retry: () => Promise<CatalogRetryOutcome>): void {
        if (!this.tasks.has(key)) {
            this.tasks.set(key, { retry, tries: 0 });
            this.count.set(this.tasks.size);
        }
        this.schedule();
    }

    /** The list answered by other means: no retry needed. */
    remove(key: string): void {
        if (this.tasks.delete(key)) {
            this.count.set(this.tasks.size);
        }
    }

    clear(): void {
        this.tasks.clear();
        this.count.set(0);
        this.round = 0;
        this.stopTimer();
    }

    /** Tries every waiting list now, one at a time. */
    run(): Promise<void> {
        this.stopTimer();
        this.running ??= this.runOnce().finally(() => {
            this.running = null;
            this.schedule();
        });
        return this.running;
    }

    private async runOnce(): Promise<void> {
        for (const [key, task] of [...this.tasks]) {
            const outcome = await task.retry().catch(() => 'failed' as const);
            const tries = task.tries + 1;
            if (
                outcome === 'ok' ||
                (outcome === 'empty' && tries >= EMPTY_TRIES)
            ) {
                this.tasks.delete(key);
            } else if (this.tasks.has(key)) {
                this.tasks.set(key, { ...task, tries });
            }
            if (outcome === 'failed') {
                break;
            }
        }
        this.count.set(this.tasks.size);
        this.round = this.tasks.size > 0 ? this.round + 1 : 0;
    }

    private schedule(): void {
        if (this.timer || this.running || this.tasks.size === 0) {
            return;
        }
        const delays = CATALOG_RETRY_DELAYS_MS;
        this.wait(delays[Math.min(this.round, delays.length - 1)]);
    }

    private wait(ms: number): void {
        this.stopTimer();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.run();
        }, ms);
    }

    private stopTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
