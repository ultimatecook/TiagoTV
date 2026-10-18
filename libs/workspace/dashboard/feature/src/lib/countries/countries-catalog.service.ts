import { computed, inject, Injectable } from '@angular/core';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import { buildCountriesCatalog } from './countries-catalog';
import type { CountryChannel } from './country-channels';

/**
 * "Por países" reads the live catalog the sports views keep (the Home
 * loads it, so the page usually opens on it at once) and plays a channel
 * the same way.
 */
@Injectable({ providedIn: 'root' })
export class CountriesCatalogService {
    private readonly sports = inject(SportsCatalogService);

    readonly loading = this.sports.loading;
    readonly failed = this.sports.failed;
    readonly hasSource = computed(() => this.sports.source() !== null);
    readonly regions = computed(() => {
        const live = this.sports.liveCatalog();
        return live
            ? buildCountriesCatalog(live.categories, live.streams)
            : null;
    });

    /** Loads the catalog unless a fresh one is held. */
    load(): void {
        void this.sports.load();
    }

    play(channel: CountryChannel): void {
        this.sports.play({
            streamId: channel.streamId,
            categoryId: channel.categoryId,
            title: channel.title,
            icon: channel.icon,
        });
    }
}
