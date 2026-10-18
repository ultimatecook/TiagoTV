import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CountriesCatalogService } from '../countries-catalog.service';
import { CountryFlagComponent } from './country-flag.component';

/** Placeholder cards while the catalog loads. */
const SKELETON_CARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * "Por países" (/workspace/countries): a card per country the source
 * carries in Spanish or English, with its flag and how many channels it
 * has, by region. A card opens the country's channels.
 */
@Component({
    selector: 'lib-countries-page',
    imports: [CountryFlagComponent, MatIcon, RouterLink, TranslatePipe],
    templateUrl: './countries-page.component.html',
    styleUrl: './countries-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountriesPageComponent {
    readonly countries = inject(CountriesCatalogService);
    readonly skeletons = SKELETON_CARDS;

    readonly summary = computed(() => {
        const regions = this.countries.regions() ?? [];
        let countries = 0;
        let channels = 0;
        for (const region of regions) {
            for (const country of region.countries) {
                countries++;
                channels += country.channelCount;
            }
        }
        return countries > 0 ? { countries, channels } : null;
    });

    constructor() {
        this.countries.load();
    }

    retry(): void {
        this.countries.load();
    }
}
