import { Injectable } from '@angular/core';

/**
 * `normal`: what a page waits for (a first import, a platform's page, the
 * lists Series / Películas show when nothing is stored). `background`: the
 * refresh of the platforms' lists, which only runs while nothing else
 * waits.
 */
export type CatalogPriority = 'normal' | 'background';

/**
 * The catalog's provider work, one task at a time: a first-run import of
 * one kind, or one platform category's list. The provider allows one
 * connection and refuses bursts, so Series, Películas, the platform pages
 * and the Home's sections queue here instead of asking at once. A task
 * waiting at `normal` priority runs before every `background` one.
 */
@Injectable({ providedIn: 'root' })
export class CatalogRequests {
    private readonly queues: Record<CatalogPriority, (() => void)[]> = {
        normal: [],
        background: [],
    };
    private running = false;

    /** Runs `task` once the tasks ahead of it (by priority) have settled. */
    run<T>(
        task: () => Promise<T>,
        priority: CatalogPriority = 'normal'
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queues[priority].push(() => {
                let result: Promise<T>;
                try {
                    result = task();
                } catch (error) {
                    result = Promise.reject(error);
                }
                void result.then(resolve, reject).finally(() => {
                    this.running = false;
                    this.next();
                });
            });
            // Never synchronously: a task starts once its caller returned.
            void Promise.resolve().then(() => this.next());
        });
    }

    /** Tasks queued and not started yet. */
    waiting(): number {
        return this.queues.normal.length + this.queues.background.length;
    }

    private next(): void {
        if (this.running) {
            return;
        }
        const job =
            this.queues.normal.shift() ?? this.queues.background.shift();
        if (job) {
            this.running = true;
            job();
        }
    }
}

/** Resolves after `ms`: the pause between a refused request and its retry. */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
