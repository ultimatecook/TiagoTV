import { PREFETCH } from '../core/request-queue';
import type { CatalogKind, XtreamCategory, XtreamClient } from '../xtream/client';
import { REFRESH_MS, type CatalogPersist } from './catalog-persist';
import { loadCountryRows, type LoadedCountry } from './live';

/**
 * What the session already loaded, in memory: category lists change with
 * the provider's line-up, not by the minute, and are kept across launches
 * too (catalog-persist.ts): a kept list answers at once, and one older
 * than REFRESH_MS is asked again in the background for the next start.
 * (Today's matches are the sports board's, data/sports-board.ts.)
 */
const CATEGORIES_MS = 30 * 60 * 1000;
const COUNTRY_MS = 20 * 60 * 1000;

interface Entry<T> {
    readonly at: number;
    readonly value: Promise<T>;
}

export type Progress = (done: number, total: number) => void;

export class CatalogCache {
    private readonly entries = new Map<string, Entry<unknown>>();

    constructor(
        readonly client: XtreamClient,
        private readonly persist: CatalogPersist,
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
        return this.remember(`categories:${kind}`, CATEGORIES_MS, () => {
            const kept = this.persist.lists(kind);
            const ask = (background: boolean) =>
                this.client.categories(kind, background ? PREFETCH : undefined).then((list) => {
                    if (list.length > 0) {
                        this.persist.saveLists(kind, list);
                    }
                    return list;
                });
            if (kept && kept.value.length > 0) {
                this.client.knowCategories(kind, kept.value);
                if (this.now() - kept.at > REFRESH_MS) {
                    ask(true).then(undefined, () => undefined);
                }
                return Promise.resolve(kept.value);
            }
            return ask(false);
        });
    }

    country(id: string, onProgress?: Progress): Promise<LoadedCountry> {
        return this.remember(`country:${id}`, COUNTRY_MS, async () =>
            loadCountryRows(this.client, await this.categories('live'), id, onProgress)
        );
    }
}
