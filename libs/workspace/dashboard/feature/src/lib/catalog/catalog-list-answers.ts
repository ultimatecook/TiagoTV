import { computed, inject, Injectable, signal } from '@angular/core';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import type { PlatformTitle } from '../platforms/platform-titles';
import type { PlatformCategory } from '../platforms/streaming-platforms';
import {
    CatalogListStore,
    fromStoredList,
    toStoredList,
    type StoredCategoryList,
} from './catalog-list-store';
import type { CatalogRetryOutcome } from './catalog-list-retry';
import type { CategoryLookup } from './catalog-list-views';

interface CategoryAnswer {
    readonly playlistId: string;
    readonly titles: readonly PlatformTitle[];
    readonly at: number;
}

/** A category's last request that went wrong, for the retry and Diagnóstico. */
export interface CategoryFailure {
    readonly playlistId: string;
    readonly at: number;
    readonly outcome: 'failed' | 'empty';
}

/** A category's list as known now, for Diagnóstico. */
export interface CategoryListState {
    readonly titles: number | null;
    readonly at: number | null;
    readonly failure: CategoryFailure | null;
}

/**
 * What the platforms' category lists answered, per source: kept in memory
 * and across launches (`CatalogListStore`), with each category's last
 * failure. An older answer outlives a failed or empty reload.
 */
@Injectable({ providedIn: 'root' })
export class CatalogListAnswers {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly store = inject(CatalogListStore);
    private readonly answers = signal<ReadonlyMap<string, CategoryAnswer>>(
        new Map()
    );
    private readonly failures = signal<ReadonlyMap<string, CategoryFailure>>(
        new Map()
    );
    private readonly hydrations = new Map<string, Promise<void>>();
    private generationValue = 0;

    /** The current source's answers, as the views read them. */
    readonly lookup = computed<CategoryLookup>(() => {
        const playlistId = this.platforms.source()?._id;
        const answers = this.answers();
        const failures = this.failures();
        return {
            titlesOf: (category) => {
                const answer = answers.get(answerKey(category));
                return answer && answer.playlistId === playlistId
                    ? answer.titles
                    : undefined;
            },
            failed: (category) =>
                !!playlistId &&
                failures.get(answerKey(category))?.playlistId === playlistId,
        };
    });

    /** Bumped by `clear`: what was asked before it is not kept. */
    generation(): number {
        return this.generationValue;
    }

    /** Whether a list with titles, younger than `maxAge`, is held. */
    isFresh(
        playlistId: string,
        category: PlatformCategory,
        maxAge: number
    ): boolean {
        const known = this.answers().get(answerKey(category));
        return (
            known?.playlistId === playlistId &&
            known.titles.length > 0 &&
            Date.now() - known.at < maxAge
        );
    }

    /** Whether the category's last request failed less than `ms` ago. */
    failedWithin(
        playlistId: string,
        category: PlatformCategory,
        ms: number
    ): boolean {
        const failure = this.failures().get(answerKey(category));
        return (
            failure?.playlistId === playlistId &&
            failure.outcome === 'failed' &&
            Date.now() - failure.at < ms
        );
    }

    state(category: PlatformCategory): CategoryListState {
        const playlistId = this.platforms.source()?._id;
        const answer = this.answers().get(answerKey(category));
        const failure = this.failures().get(answerKey(category));
        const own = answer && answer.playlistId === playlistId ? answer : null;
        return {
            titles: own ? own.titles.length : null,
            at: own?.at ?? null,
            failure:
                failure && failure.playlistId === playlistId ? failure : null,
        };
    }

    /**
     * Keeps a request's answer: the titles (kept across launches), or,
     * with none (`undefined`: it failed), the failure.
     */
    record(
        playlistId: string,
        category: PlatformCategory,
        titles: readonly PlatformTitle[] | undefined
    ): CatalogRetryOutcome {
        const key = answerKey(category);
        const at = Date.now();
        if (!titles?.length) {
            const outcome: CategoryFailure['outcome'] = titles
                ? 'empty'
                : 'failed';
            this.failures.update((state) =>
                new Map(state).set(key, { playlistId, at, outcome })
            );
            if (titles && this.answers().get(key)?.playlistId !== playlistId) {
                // Nothing better known: the platform answered, with none.
                this.set(key, { playlistId, titles, at });
            }
            return outcome;
        }
        this.set(key, { playlistId, titles, at });
        this.failures.update((state) => without(state, key));
        void this.store.write(toStoredList(playlistId, category, titles, at));
        return 'ok';
    }

    /** Resolves once the lists kept from the last launch are read. */
    ready(): Promise<void> {
        const playlistId = this.platforms.source()?._id;
        if (!playlistId) {
            return Promise.resolve();
        }
        let hydration = this.hydrations.get(playlistId);
        if (!hydration) {
            const generation = this.generationValue;
            hydration = this.store
                .read(playlistId)
                .then((lists) => {
                    if (generation === this.generationValue) {
                        this.adopt(playlistId, lists);
                    }
                })
                .catch(() => undefined);
            this.hydrations.set(playlistId, hydration);
        }
        return hydration;
    }

    /** Forgets every answer, here and across launches. */
    async clear(): Promise<void> {
        this.generationValue++;
        this.answers.set(new Map());
        this.failures.set(new Map());
        this.hydrations.clear();
        await this.store.clear();
    }

    private set(key: string, answer: CategoryAnswer): void {
        this.answers.update((state) => new Map(state).set(key, answer));
    }

    /** The lists kept from the last launch, unless newer ones came since. */
    private adopt(
        playlistId: string,
        lists: readonly StoredCategoryList[]
    ): void {
        if (lists.length === 0) {
            return;
        }
        this.answers.update((state) => {
            const next = new Map(state);
            for (const list of lists) {
                const key = `${list.kind}:${list.categoryId}`;
                const known = next.get(key);
                if (known?.playlistId !== playlistId || known.at < list.at) {
                    next.set(key, {
                        playlistId,
                        titles: fromStoredList(list),
                        at: list.at,
                    });
                }
            }
            return next;
        });
    }
}

export function answerKey(category: PlatformCategory): string {
    return `${category.kind}:${category.id}`;
}

function without<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
    const next = new Map(map);
    next.delete(key);
    return next;
}
