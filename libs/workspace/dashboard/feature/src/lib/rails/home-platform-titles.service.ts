import { computed, inject, Injectable } from '@angular/core';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogKind } from '../catalog/catalog-titles';
import { daySeed } from '../platforms/platform-seed';
import { pickSeriesForYou, rankTopMovies } from './home-platform-titles';

/**
 * The titles the Home's "Top 10 películas hoy" and "Series para vos" pick
 * from: the platforms' aggregated catalog (`CatalogService`), which reads
 * the catalog the app already stored — no provider request — and only on a
 * first run, with nothing stored, loads the platforms' own lists one
 * platform at a time. Nothing is read until a section asks (`load`).
 */
@Injectable({ providedIn: 'root' })
export class HomePlatformTitlesService {
    private readonly catalog = inject(CatalogService);

    /** The day's draw, taken once a visit (see `daySeed`). */
    readonly seed = daySeed();

    readonly topMovies = computed(() =>
        rankTopMovies(this.catalog.titles('movie') ?? [], this.seed)
    );
    readonly seriesForYou = computed(() =>
        pickSeriesForYou(this.catalog.titles('series') ?? [], this.seed)
    );

    /** Still to come: a section shows its placeholders meanwhile. */
    readonly moviesPending = computed(
        () => this.catalog.status('movie') === 'loading'
    );
    readonly seriesPending = computed(
        () => this.catalog.status('series') === 'loading'
    );

    load(kind: CatalogKind): Promise<void> {
        return this.catalog.load(kind);
    }
}
