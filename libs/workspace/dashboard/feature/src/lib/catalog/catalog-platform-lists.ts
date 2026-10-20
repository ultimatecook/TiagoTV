import { computed, inject, Injectable, signal } from '@angular/core';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import type { PlatformTitle } from '../platforms/platform-titles';
import { mergePlatformTitles } from '../platforms/platform-versions';
import type {
    PlatformCategory,
    StreamingPlatform,
} from '../platforms/streaming-platforms';
import { takeTurns } from './catalog-fairness';
import { CatalogRequests, delay } from './catalog-requests';
import type { CatalogKind, PlatformTitleList } from './catalog-titles';

/** A category's list changes with the provider's uploads, not by the minute. */
const FRESH_MS = 30 * 60 * 1000;
/** The categories that failed are asked once more, this much later. */
export const CATALOG_LISTS_RETRY_MS = 5_000;

interface CategoryAnswer {
    readonly playlistId: string;
    /** Null: the request failed. */
    readonly titles: readonly PlatformTitle[] | null;
    readonly at: number;
}

interface Queued {
    readonly platform: StreamingPlatform;
    readonly category: PlatformCategory;
}

/** What the platforms' lists of one kind hold so far. */
export interface PlatformListsView {
    readonly lists: readonly PlatformTitleList[];
    /** The platforms carrying the kind, by the source's categories. */
    readonly total: number;
    /** Of those, the ones that answered (or failed) at least once. */
    readonly answered: number;
    /** Of those, the ones every request of which failed. */
    readonly failed: number;
}

/**
 * Series / Películas where no catalog is stored and none can be imported
 * (the browser build, or a failed import): the platforms' own categories
 * of the kind, one request at a time (`CatalogRequests`) and with the
 * platforms taking turns — every platform's first category, then each
 * one's second… — so the first answers come from several platforms, not
 * all from the biggest one. A platform whose page already loaded its lists
 * asks nothing again.
 */
@Injectable({ providedIn: 'root' })
export class CatalogPlatformLists {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly requests = inject(CatalogRequests);
    private readonly answers = signal<ReadonlyMap<string, CategoryAnswer>>(
        new Map()
    );
    private readonly loading = new Map<CatalogKind, Promise<void>>();
    private readonly views = {
        movie: computed(() => this.compute('movie')),
        series: computed(() => this.compute('series')),
    };

    view(kind: CatalogKind): PlatformListsView {
        return this.views[kind]();
    }

    private compute(kind: CatalogKind): PlatformListsView {
        const playlistId = this.platforms.source()?._id;
        const answers = this.answers();
        const lists: PlatformTitleList[] = [];
        let total = 0;
        let answered = 0;
        let failed = 0;
        for (const shelf of this.platforms.shelves() ?? []) {
            const categories = ofKind(shelf.categories, kind);
            if (categories.length === 0) {
                continue;
            }
            total++;
            const own = this.platforms.titlesOf(shelf.platform.id);
            if (own) {
                lists.push({ platform: shelf.platform, titles: own });
                answered++;
                continue;
            }
            const known = categories
                .map((category) => answers.get(answerKey(kind, category)))
                .filter((answer) => answer?.playlistId === playlistId);
            const loaded = known
                .map((answer) => answer?.titles)
                .filter((titles) => !!titles) as (readonly PlatformTitle[])[];
            if (loaded.length > 0) {
                lists.push({
                    platform: shelf.platform,
                    titles: mergePlatformTitles(loaded),
                });
            }
            if (known.length > 0) {
                answered++;
            }
            if (known.length === categories.length && loaded.length === 0) {
                failed++;
            }
        }
        return { lists, total, answered, failed };
    }

    /** Asks for the kind's lists not loaded yet (or no longer fresh). */
    load(kind: CatalogKind): Promise<void> {
        let request = this.loading.get(kind);
        if (!request) {
            request = this.loadAll(kind).finally(() =>
                this.loading.delete(kind)
            );
            this.loading.set(kind, request);
        }
        return request;
    }

    private async loadAll(kind: CatalogKind): Promise<void> {
        await this.platforms.loadShelves();
        const playlistId = this.platforms.source()?._id;
        if (!playlistId) {
            return;
        }
        const wanted: Queued[] = [];
        for (const shelf of this.platforms.shelves() ?? []) {
            if (!this.platforms.titlesOf(shelf.platform.id)) {
                for (const category of ofKind(shelf.categories, kind)) {
                    wanted.push({ platform: shelf.platform, category });
                }
            }
        }
        const queue = takeTurns(wanted);
        const failed: Queued[] = [];
        for (const item of queue) {
            if (!(await this.ask(playlistId, kind, item.category))) {
                failed.push(item);
            }
        }
        if (failed.length > 0) {
            await delay(CATALOG_LISTS_RETRY_MS);
            for (const item of failed) {
                await this.ask(playlistId, kind, item.category);
            }
        }
    }

    /** One category's list, unless a fresh one is held; false if it failed. */
    private async ask(
        playlistId: string,
        kind: CatalogKind,
        category: PlatformCategory
    ): Promise<boolean> {
        const key = answerKey(kind, category);
        const known = this.answers().get(key);
        if (
            known?.playlistId === playlistId &&
            known.titles &&
            Date.now() - known.at < FRESH_MS
        ) {
            return true;
        }
        const answer = await this.requests
            .run(async () =>
                // The source changed meanwhile: its lists are not this one's.
                this.platforms.source()?._id === playlistId
                    ? await this.platforms.categoryTitles(category)
                    : null
            )
            .catch(() => undefined);
        if (answer === null) {
            return true;
        }
        if (answer === undefined && known?.playlistId === playlistId) {
            // An older answer outlives a failed reload.
            return !!known.titles;
        }
        this.answers.update((state) =>
            new Map(state).set(key, {
                playlistId,
                titles: answer ?? null,
                at: Date.now(),
            })
        );
        return answer !== undefined;
    }
}

function ofKind(
    categories: readonly PlatformCategory[],
    kind: CatalogKind
): PlatformCategory[] {
    return categories.filter((category) => category.kind === kind);
}

function answerKey(kind: CatalogKind, category: PlatformCategory): string {
    return `${kind}:${category.id}`;
}
