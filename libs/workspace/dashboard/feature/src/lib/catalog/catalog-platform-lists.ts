import {
    computed,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
    type Signal,
} from '@angular/core';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import type { PlatformTitle } from '../platforms/platform-titles';
import { PREFERRED_VERSION_LANGUAGE } from '../platforms/version-language';
import type {
    PlatformCategory,
    StreamingPlatform,
    StreamingPlatformId,
} from '../platforms/streaming-platforms';
import { takeTurns } from './catalog-fairness';
import {
    answerKey,
    CatalogListAnswers,
    type CategoryListState,
} from './catalog-list-answers';
import {
    CATALOG_RETRY_DELAYS_MS,
    CatalogListRetry,
    type CatalogRetryOutcome,
} from './catalog-list-retry';
import {
    categoriesOfKind,
    listsView,
    platformTitlesOf,
    progressOf,
    type PlatformListsProgress,
    type PlatformListsView,
} from './catalog-list-views';
import { categoryLabel, CatalogRequestLog } from './catalog-request-log';
import {
    CatalogRequests,
    delay,
    type CatalogPriority,
} from './catalog-requests';
import type { CatalogKind } from './catalog-titles';

export type { PlatformListsProgress, PlatformListsView };

/** A platform's page asks again for its lists older than this. */
export const PLATFORM_LISTS_FRESH_MS = 60 * 60 * 1000;
/** The background refresh asks each list at most twice a day. */
export const PLATFORM_LISTS_REFRESH_MS = 12 * 60 * 60 * 1000;
/** The lists that failed are asked once more, this much later. */
export const CATALOG_LISTS_RETRY_MS = 5_000;

interface Queued {
    readonly platform: StreamingPlatform;
    readonly category: PlatformCategory;
}

/**
 * The platforms' own category lists, one store for the whole app: Series
 * and Películas (with the stored catalog, or alone where nothing is
 * stored), Buscar, and each platform's page. A list is asked once, one
 * request at a time (`CatalogRequests`); what answered shows at once (a
 * page fills as its lists arrive), and what failed is asked again a little
 * later, then by `CatalogListRetry` (when playback stops, and on a timer).
 * The answers persist across launches (`CatalogListAnswers`), so the next
 * launch shows them before any request.
 */
@Injectable({ providedIn: 'root' })
export class CatalogPlatformLists {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly requests = inject(CatalogRequests);
    private readonly answers = inject(CatalogListAnswers);
    private readonly retry = inject(CatalogListRetry);
    private readonly log = inject(CatalogRequestLog);
    private readonly language = inject(PREFERRED_VERSION_LANGUAGE);

    /** The loads running now: their key → the kind or platform loading. */
    private readonly running = signal<ReadonlyMap<string, string>>(new Map());
    private readonly inflight = new Map<string, Promise<CatalogRetryOutcome>>();
    private readonly loads = new Map<string, Promise<void>>();
    private readonly platformViews = new Map<
        StreamingPlatformId,
        Signal<PlatformTitle[] | null>
    >();
    private readonly views = {
        movie: computed(() => this.computeView('movie')),
        series: computed(() => this.computeView('series')),
    };

    constructor() {
        // The kept lists show as soon as the source is known.
        effect(() => {
            if (this.platforms.source()?._id) {
                untracked(() => void this.answers.ready());
            }
        });
    }

    view(kind: CatalogKind): PlatformListsView {
        return this.views[kind]();
    }

    /** Whether the kind's lists are being asked now. */
    loading(kind: CatalogKind): boolean {
        return [...this.running().values()].includes(kind);
    }

    /** A platform's titles, both kinds, newest first; null until one answered. */
    platformTitles(id: StreamingPlatformId): PlatformTitle[] | null {
        let view = this.platformViews.get(id);
        if (!view) {
            view = computed(() =>
                platformTitlesOf(
                    this.shelfOf(id),
                    this.answers.lookup(),
                    this.language()
                )
            );
            this.platformViews.set(id, view);
        }
        return view();
    }

    platformProgress(id: StreamingPlatformId): PlatformListsProgress {
        return progressOf(
            this.shelfOf(id),
            this.answers.lookup(),
            [...this.running().values()].includes(id)
        );
    }

    /** A category's list as known now, for Diagnóstico. */
    categoryState(category: PlatformCategory): CategoryListState {
        return this.answers.state(category);
    }

    /** Resolves once the lists kept from the last launch are read. */
    ready(): Promise<void> {
        return this.answers.ready();
    }

    /** Asks the kind's lists not known yet (or older than `maxAge`). */
    load(
        kind: CatalogKind,
        priority: CatalogPriority = 'normal',
        maxAge = PLATFORM_LISTS_FRESH_MS
    ): Promise<void> {
        return this.once(`${kind}:${priority}`, kind, async (playlistId) => {
            const wanted: Queued[] = [];
            for (const shelf of this.platforms.shelves() ?? []) {
                for (const category of categoriesOfKind(
                    shelf.categories,
                    kind
                )) {
                    // A list that just failed waits for its retry.
                    if (
                        priority === 'normal' ||
                        !this.answers.failedWithin(
                            playlistId,
                            category,
                            CATALOG_RETRY_DELAYS_MS[0]
                        )
                    ) {
                        wanted.push({ platform: shelf.platform, category });
                    }
                }
            }
            // The platforms take turns: the first answers are several's.
            await this.askAll(playlistId, takeTurns(wanted), priority, maxAge);
        });
    }

    /** The background refresh: Series, Películas and Buscar keep it current. */
    refresh(kind: CatalogKind): Promise<void> {
        return this.load(kind, 'background', PLATFORM_LISTS_REFRESH_MS);
    }

    /** A platform's page: its lists, both kinds, one at a time. */
    loadPlatform(id: StreamingPlatformId): Promise<void> {
        return this.once(`platform:${id}`, id, async (playlistId) => {
            const shelf = this.shelfOf(id);
            if (shelf) {
                const items = shelf.categories.map((category) => ({
                    platform: shelf.platform,
                    category,
                }));
                await this.askAll(
                    playlistId,
                    items,
                    'normal',
                    PLATFORM_LISTS_FRESH_MS
                );
            }
        });
    }

    /** Forgets every list, here and across launches (Diagnóstico). */
    async clear(): Promise<void> {
        this.inflight.clear();
        this.retry.clear();
        await this.answers.clear();
    }

    private computeView(kind: CatalogKind): PlatformListsView {
        return listsView(
            this.platforms.shelves() ?? [],
            kind,
            this.answers.lookup(),
            this.language()
        );
    }

    /** "EN · AMAZON-PRIME": how Diagnóstico names the category. */
    private labelOf(category: PlatformCategory): string {
        const name = this.platforms.categoryName(category);
        return name ? categoryLabel(name) : category.id;
    }

    private shelfOf(id: StreamingPlatformId) {
        return this.platforms
            .shelves()
            ?.find((shelf) => shelf.platform.id === id);
    }

    /** Runs `task` once at a time, with the kept lists read and shelves known. */
    private once(
        key: string,
        busyKey: string,
        task: (playlistId: string) => Promise<void>
    ): Promise<void> {
        let request = this.loads.get(key);
        if (!request) {
            this.running.update((state) => new Map(state).set(key, busyKey));
            request = (async () => {
                await this.answers.ready();
                await this.platforms.loadShelves();
                const playlistId = this.platforms.source()?._id;
                if (playlistId) {
                    await task(playlistId);
                }
            })().finally(() => {
                this.loads.delete(key);
                this.running.update((state) => {
                    const next = new Map(state);
                    next.delete(key);
                    return next;
                });
            });
            this.loads.set(key, request);
        }
        return request;
    }

    private async askAll(
        playlistId: string,
        items: readonly Queued[],
        priority: CatalogPriority,
        maxAge: number
    ): Promise<void> {
        const missed: Queued[] = [];
        for (const item of items) {
            if ((await this.ask(playlistId, item, priority, maxAge)) !== 'ok') {
                missed.push(item);
            }
        }
        if (missed.length === 0) {
            return;
        }
        await delay(CATALOG_LISTS_RETRY_MS);
        for (const item of missed) {
            if ((await this.ask(playlistId, item, priority, 0)) !== 'ok') {
                this.retry.add(retryKey(playlistId, item.category), () =>
                    this.ask(playlistId, item, 'background', 0)
                );
            }
        }
    }

    /** One category's list, unless a fresh one is held; shared while asked. */
    private ask(
        playlistId: string,
        item: Queued,
        priority: CatalogPriority,
        maxAge: number
    ): Promise<CatalogRetryOutcome> {
        if (this.answers.isFresh(playlistId, item.category, maxAge)) {
            return Promise.resolve('ok');
        }
        const key = answerKey(item.category);
        let pending = this.inflight.get(key);
        if (!pending) {
            pending = this.fetch(playlistId, item.category, priority).finally(
                () => {
                    if (this.inflight.get(key) === pending) {
                        this.inflight.delete(key);
                    }
                }
            );
            this.inflight.set(key, pending);
        }
        return pending;
    }

    private async fetch(
        playlistId: string,
        category: PlatformCategory,
        priority: CatalogPriority
    ): Promise<CatalogRetryOutcome> {
        const generation = this.answers.generation();
        const current = () =>
            generation === this.answers.generation() &&
            this.platforms.source()?._id === playlistId;
        const titles = await this.requests
            .run(
                () =>
                    current()
                        ? this.log.track(
                              category.kind === 'movie'
                                  ? 'get_vod_streams'
                                  : 'get_series',
                              this.labelOf(category),
                              () => this.platforms.categoryTitles(category)
                          )
                        : Promise.resolve(null),
                priority
            )
            .catch(() => undefined);
        // The source changed, or the lists were cleared, meanwhile.
        if (titles === null || !current()) {
            return 'ok';
        }
        const outcome = this.answers.record(playlistId, category, titles);
        if (outcome === 'ok') {
            this.retry.remove(retryKey(playlistId, category));
        }
        return outcome;
    }
}

function retryKey(playlistId: string, category: PlatformCategory): string {
    return `${playlistId}|${answerKey(category)}`;
}
