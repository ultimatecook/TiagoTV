import type { StorageLike } from '../core/storage';
import type { CatalogCache } from './catalog-cache';
import { loadSports, type SportsData } from './sports';
import { SportsNotes } from './sports-plan';

/**
 * Today's sports board, one for the app: Inicio, Deportes, a league's
 * page and Buscar read it. A load runs at most once at a time (asking
 * while one runs joins it), its event categories first in the request
 * queue's sports turn (ahead of the catalog's prefetch); the board shows
 * as soon as they are in, and again with the rest. It is fresh for
 * SPORTS_MS: event channels rename themselves as matches start and end.
 */
export const SPORTS_MS = 4 * 60 * 1000;

export type SportsListener = (data: SportsData) => void;

export class SportsBoard {
    private latest: SportsData | null = null;
    private inFlight: Promise<SportsData> | null = null;
    private readonly listeners: SportsListener[] = [];
    private readonly notes: SportsNotes;
    /** The last load's failure, if it failed. */
    lastError: unknown = null;

    constructor(
        private readonly cache: CatalogCache,
        scope: string,
        storage: StorageLike | null
    ) {
        this.notes = new SportsNotes(scope, storage);
    }

    /** The board as last shown (null before the first one). */
    get data(): SportsData | null {
        return this.latest;
    }

    get loading(): boolean {
        return this.inFlight !== null;
    }

    onChange(listener: SportsListener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        };
    }

    fresh(now = Date.now()): boolean {
        return !!this.latest && this.latest.complete && now - this.latest.loadedAt < SPORTS_MS;
    }

    /** The board, loaded unless fresh (`force`: Diagnóstico's Reintentar). */
    refresh(force = false): Promise<SportsData> {
        if (this.inFlight) {
            return this.inFlight;
        }
        if (!force && this.latest && this.fresh()) {
            return Promise.resolve(this.latest);
        }
        const run = this.cache.categories('live').then((categories) =>
            loadSports(this.cache.client, categories, {
                notes: this.notes,
                onPartial: (data) => {
                    // A complete board stays until the next complete one.
                    if (!this.latest || !this.latest.complete) {
                        this.publish(data);
                    }
                },
                onDiscovered: (data) => this.publish(data),
            })
        );
        this.inFlight = run.then(
            (data) => {
                this.inFlight = null;
                this.lastError = null;
                this.publish(data);
                return data;
            },
            (error) => {
                this.inFlight = null;
                this.lastError = error;
                throw error;
            }
        );
        return this.inFlight;
    }

    private publish(data: SportsData): void {
        this.latest = data;
        for (const listener of this.listeners.slice()) {
            listener(data);
        }
    }
}
