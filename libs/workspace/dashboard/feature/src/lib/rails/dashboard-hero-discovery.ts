import {
    computed,
    DestroyRef,
    effect,
    inject,
    signal,
    untracked,
} from '@angular/core';
import type { PortalAddedItem } from '@iptvnator/shared/interfaces';
import { CatalogService } from '../catalog/catalog.service';
import { HomeHeroBackdropsService } from './home-hero-backdrops.service';
import { catalogHeroCandidates, catalogHeroItems } from './home-hero-catalog';

/**
 * How long the skeleton may wait for the first discovery title's backdrop
 * (a title page or two, one at a time) when nothing else is featured.
 */
export const DASHBOARD_HERO_DISCOVERY_WAIT_MS = 5000;

/**
 * The hero's discovery titles from Series / Películas' stored catalog:
 * read once per source (`loadStored`, no provider request), then featured
 * only as their backdrops are found (`HomeHeroBackdropsService`).
 */
export interface DashboardHeroDiscovery {
    /** The current source's stored catalog is still being read. */
    readonly reading: () => boolean;
    /** The catalog has candidates (featured or not): no raw rows then. */
    readonly hasCatalog: () => boolean;
    /** The candidates with a backdrop, as the hero's added rows. */
    readonly added: () => PortalAddedItem[];
    /** The first backdrop is still being looked for, for a moment. */
    readonly waiting: () => boolean;
}

/** Must run in an injection context (the hero presenter's). */
export function injectDashboardHeroDiscovery(): DashboardHeroDiscovery {
    const catalog = inject(CatalogService);
    const backdrops = inject(HomeHeroBackdropsService);
    const readFor = signal<string | null>(null);
    const waitOver = signal(false);

    const reading = computed(() => {
        const sourceId = catalog.source()?._id;
        return !!sourceId && readFor() !== sourceId;
    });
    const candidates = computed(() =>
        catalogHeroCandidates(
            catalog.titles('movie'),
            catalog.titles('series'),
            catalog.heroLead()
        )
    );

    const wait = setTimeout(
        () => waitOver.set(true),
        DASHBOARD_HERO_DISCOVERY_WAIT_MS
    );
    inject(DestroyRef).onDestroy(() => clearTimeout(wait));
    // The stored copy only: no provider request (`loadStored`).
    const read = (sourceId: string) =>
        Promise.all([catalog.loadStored('movie'), catalog.loadStored('series')])
            .catch(() => undefined)
            .finally(() => readFor.set(sourceId));
    effect(() => {
        const sourceId = catalog.source()?._id;
        if (sourceId) {
            untracked(() => void read(sourceId));
        }
    });
    effect(() => {
        const sourceId = catalog.source()?._id;
        const titles = candidates();
        if (sourceId && !reading() && titles.length > 0) {
            untracked(() => backdrops.probe(sourceId, titles));
        }
    });

    return {
        reading,
        hasCatalog: computed(() => candidates().length > 0),
        added: computed(() => {
            const source = catalog.source();
            return source
                ? catalogHeroItems(backdrops.found(source._id), source)
                : [];
        }),
        waiting: computed(() => {
            const sourceId = catalog.source()?._id;
            return !!sourceId && !waitOver() && backdrops.pending(sourceId);
        }),
    };
}
