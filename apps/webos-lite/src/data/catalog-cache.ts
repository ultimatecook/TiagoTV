import type { CatalogKind, XtreamCategory, XtreamClient } from '../xtream/client';
import { loadCountryRows, type LoadedCountry } from './live';
import { loadSports, type SportsData } from './sports';

/**
 * What the session already loaded, in memory: category lists change with
 * the provider's line-up, not by the minute; event channels rename
 * themselves after each match, so the sports board is kept briefly.
 */
const CATEGORIES_MS = 30 * 60 * 1000;
const COUNTRY_MS = 20 * 60 * 1000;
export const SPORTS_MS = 4 * 60 * 1000;

interface Entry<T> {
    readonly at: number;
    readonly value: Promise<T>;
}

export type Progress = (done: number, total: number) => void;

export class CatalogCache {
    private readonly entries = new Map<string, Entry<unknown>>();

    constructor(
        readonly client: XtreamClient,
        private readonly now: () => number = Date.now
    ) {}

    private remember<T>(key: string, maxAge: number, load: () => Promise<T>): Promise<T> {
        const entry = this.entries.get(key) as Entry<T> | undefined;
        if (entry && this.now() - entry.at < maxAge) {
            return entry.value;
        }
        const value = load();
        this.entries.set(key, { at: this.now(), value });
        // A failure is not remembered: the next visit asks again.
        value.then(undefined, () => {
            if (this.entries.get(key)?.value === value) {
                this.entries.delete(key);
            }
        });
        return value;
    }

    forget(prefix = ''): void {
        this.entries.forEach((_, key) => {
            if (key.indexOf(prefix) === 0) {
                this.entries.delete(key);
            }
        });
    }

    categories(kind: CatalogKind): Promise<XtreamCategory[]> {
        return this.remember(`categories:${kind}`, CATEGORIES_MS, () =>
            this.client.categories(kind)
        );
    }

    country(id: string, onProgress?: Progress): Promise<LoadedCountry> {
        return this.remember(`country:${id}`, COUNTRY_MS, async () =>
            loadCountryRows(this.client, await this.categories('live'), id, onProgress)
        );
    }

    /** Today's matches and the competitions' channels (kept briefly). */
    sports(onProgress?: Progress, background = false): Promise<SportsData> {
        return this.remember('sports', SPORTS_MS, async () =>
            loadSports(this.client, await this.categories('live'), onProgress, background)
        );
    }

    /** The sports data if loaded and still fresh, without asking. */
    sportsNow(): Promise<SportsData> | null {
        const entry = this.entries.get('sports');
        return entry && this.now() - entry.at < SPORTS_MS ? (entry.value as Promise<SportsData>) : null;
    }
}
