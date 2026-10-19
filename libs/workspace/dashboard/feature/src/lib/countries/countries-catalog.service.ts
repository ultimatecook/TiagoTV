import { computed, inject, Injectable, type DestroyRef } from '@angular/core';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import { buildCountriesTv } from './countries-catalog';

/**
 * "En vivo" reads the live catalog the sports views keep: the stored
 * copy of the source's line-up (the Home loads it, so the page usually
 * opens on it at once), its event categories kept fresh. Nothing here
 * downloads the line-up again.
 */
@Injectable({ providedIn: 'root' })
export class CountriesCatalogService {
    private readonly sports = inject(SportsCatalogService);

    readonly loading = this.sports.loading;
    readonly failed = this.sports.failed;
    readonly source = this.sports.source;
    readonly hasSource = computed(() => this.sports.source() !== null);
    readonly countries = computed(() => {
        const live = this.sports.liveCatalog();
        return live ? buildCountriesTv(live.categories, live.streams) : null;
    });

    /** Loads the catalog and keeps its events fresh while the page is open. */
    keepFresh(destroyRef: DestroyRef): void {
        this.sports.keepFresh(destroyRef);
    }

    retry(): void {
        void this.sports.load();
    }
}
