import { Injectable } from '@angular/core';

/**
 * The catalog's provider work, one task at a time: a first-run import of
 * one kind, or one platform category's list. The provider allows one
 * connection and refuses bursts, so Series, Películas and the Home's
 * sections queue here instead of asking at once.
 */
@Injectable({ providedIn: 'root' })
export class CatalogRequests {
    private tail: Promise<unknown> = Promise.resolve();

    /** Runs `task` once every task queued before it has settled. */
    run<T>(task: () => Promise<T>): Promise<T> {
        const result = this.tail.then(task);
        this.tail = result.catch(() => undefined);
        return result;
    }
}

/** Resolves after `ms`: the pause between a refused request and its retry. */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
