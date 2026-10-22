import { computed, inject, Injectable, signal } from '@angular/core';
import {
    DatabaseService,
    RuntimeCapabilitiesService,
} from '@iptvnator/services';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { CatalogListAnswers } from './catalog-list-answers';
import { CatalogListRetry } from './catalog-list-retry';
import { CatalogMembership } from './catalog-membership';
import { CatalogPlatformLists } from './catalog-platform-lists';
import { categoryLabel, CatalogRequestLog } from './catalog-request-log';
import { storedRowCounts } from './catalog-stored-rows';
import type { CatalogKind } from './catalog-titles';
import { CatalogService } from './catalog.service';

const KINDS: readonly CatalogKind[] = ['series', 'movie'];

/** One platform category, as Diagnóstico lists it. */
export interface CatalogDiagnosticsCategory {
    /** "EN · AMAZON-PRIME": the category's own name, never an address. */
    readonly label: string;
    readonly platform: string;
    /** Rows the stored catalog files in this category. */
    readonly stored: number | null;
    /** Titles its own list holds. */
    readonly listed: number | null;
    /** Of those, the ones the stored catalog holds (in any category). */
    readonly listedStored: number | null;
    readonly at: number | null;
    readonly state: 'ok' | 'empty' | 'failed' | 'pending';
}

export interface CatalogDiagnosticsKind {
    readonly kind: CatalogKind;
    /** The first-run import's status; null where nothing is imported. */
    readonly importStatus: string | null;
    readonly storedCategories: number | null;
    readonly storedRows: number | null;
    readonly categories: readonly CatalogDiagnosticsCategory[];
    /** The newest list answer. */
    readonly lastRefresh: number | null;
    readonly answered: number;
    readonly total: number;
    /** Titles per platform Series / Películas show now. */
    readonly shown: readonly {
        readonly platform: string;
        readonly titles: number;
    }[];
}

/**
 * Ajustes → Diagnóstico: what Series, Películas and Buscar are built from,
 * per kind (the stored catalog, the platforms' lists, what shows), and the
 * catalog's last provider requests (`CatalogRequestLog`). Never an
 * address, a host or the account. "Reload" forgets the catalog's caches
 * (lists, members, reads) and asks again.
 */
@Injectable({ providedIn: 'root' })
export class CatalogDiagnosticsService {
    private readonly catalog = inject(CatalogService);
    private readonly lists = inject(CatalogPlatformLists);
    private readonly answers = inject(CatalogListAnswers);
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly membership = inject(CatalogMembership);
    private readonly database = inject(DatabaseService);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly statuses = signal<Partial<Record<CatalogKind, string>>>(
        {}
    );

    readonly requests = inject(CatalogRequestLog).entries;
    /** Lists waiting for a retry (when playback stops, or later). */
    readonly pendingRetries = inject(CatalogListRetry).pending;
    readonly reloading = signal(false);
    readonly hasSource = computed(() => !!this.catalog.source());
    readonly kinds = computed(() => KINDS.map((kind) => this.report(kind)));

    /** Reads what is not live: the stored copies and the import status. */
    async read(): Promise<void> {
        const source = this.catalog.source();
        if (!source) {
            return;
        }
        void this.platforms.loadShelves();
        await Promise.all([
            this.lists.ready(),
            ...KINDS.map((kind) => this.catalog.loadStored(kind)),
        ]).catch(() => undefined);
        if (!this.runtime.supportsXtreamSqliteDataSource) {
            return;
        }
        const statuses: Partial<Record<CatalogKind, string>> = {};
        for (const kind of KINDS) {
            statuses[kind] =
                (await this.database
                    .getXtreamImportStatus(source._id, kind)
                    .catch(() => null)) ?? 'unknown';
        }
        this.statuses.set(statuses);
    }

    /** Forgets the catalog's caches, reads again and asks every list now. */
    async reload(): Promise<void> {
        if (this.reloading()) {
            return;
        }
        this.reloading.set(true);
        try {
            await this.lists.clear();
            this.membership.clear();
            this.catalog.reset();
            await this.read();
            void Promise.all(KINDS.map((kind) => this.lists.load(kind)));
        } finally {
            this.reloading.set(false);
        }
    }

    private report(kind: CatalogKind): CatalogDiagnosticsKind {
        const stored = this.catalog.storedData(kind);
        const counts = stored ? storedRowCounts(stored, kind) : null;
        const lookup = this.answers.lookup();
        const categories: CatalogDiagnosticsCategory[] = [];
        for (const shelf of this.platforms.shelves() ?? []) {
            for (const category of shelf.categories) {
                if (category.kind !== kind) {
                    continue;
                }
                const state = this.lists.categoryState(category);
                const titles = lookup.titlesOf(category);
                const name = this.platforms.categoryName(category);
                categories.push({
                    label: name ? categoryLabel(name) : category.id,
                    platform: shelf.platform.name,
                    stored: counts
                        ? (counts.byCategory.get(category.id) ?? 0)
                        : null,
                    listed: state.titles,
                    listedStored:
                        counts && titles
                            ? titles.filter((title) => counts.ids.has(title.id))
                                  .length
                            : null,
                    at: state.at,
                    state: state.failure
                        ? state.failure.outcome
                        : state.titles !== null
                          ? 'ok'
                          : 'pending',
                });
            }
        }
        const shown = new Map<string, number>();
        for (const title of this.catalog.titles(kind) ?? []) {
            shown.set(
                title.platform.name,
                (shown.get(title.platform.name) ?? 0) + 1
            );
        }
        const times = categories
            .map((category) => category.at)
            .filter((at): at is number => at !== null);
        return {
            kind,
            importStatus: this.runtime.supportsXtreamSqliteDataSource
                ? (this.statuses()[kind] ?? null)
                : null,
            storedCategories: stored ? stored.categories.length : null,
            storedRows: stored ? stored.rows.length : null,
            categories,
            lastRefresh: times.length > 0 ? Math.max(...times) : null,
            answered: categories.filter((category) => !!category.listed).length,
            total: categories.length,
            shown: [...shown.entries()]
                .map(([platform, titles]) => ({ platform, titles }))
                .sort((a, b) => b.titles - a.titles),
        };
    }
}
