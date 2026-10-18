import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    linkedSignal,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { findCountryDefinition } from '../countries';
import { findCountry } from '../countries-catalog';
import { CountriesCatalogService } from '../countries-catalog.service';
import type { CountryChannel } from '../country-channels';
import { CountryChannelCardComponent } from './country-channel-card.component';
import { CountryFlagComponent } from './country-flag.component';

/** Placeholder cards while the catalog loads. */
const SKELETON_CARDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** The chips shown before "+N más": about two rows. */
const CHIP_LIMIT = 12;

/**
 * A country's page (/workspace/countries/:countryId): its flag and name
 * on a band in its colours, a chip per category, and the chosen
 * category's channels. A channel plays in the live player.
 */
@Component({
    selector: 'lib-country-page',
    imports: [
        CountryChannelCardComponent,
        CountryFlagComponent,
        MatIcon,
        RouterLink,
        TranslatePipe,
    ],
    templateUrl: './country-page.component.html',
    styleUrl: './country-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryPageComponent {
    readonly countries = inject(CountriesCatalogService);
    readonly skeletons = SKELETON_CARDS;

    /** Bound from the route parameter. */
    readonly countryId = input<string>('');
    readonly definition = computed(() =>
        findCountryDefinition(this.countryId())
    );
    readonly country = computed(() => {
        const regions = this.countries.regions();
        return regions ? findCountry(regions, this.countryId()) : null;
    });
    /** The chip chosen on this country's page, if any. */
    private readonly chosen = signal<{ country: string; id: string } | null>(
        null
    );
    readonly category = computed(() => {
        const country = this.country();
        if (!country) {
            return null;
        }
        const chosen = this.chosen();
        return (
            (chosen?.country === country.definition.id &&
                country.categories.find(
                    (category) => category.id === chosen.id
                )) ||
            (country.categories[0] ?? null)
        );
    });

    /** Every chip, once "+N más" is pressed (per country). */
    readonly allChips = linkedSignal(() => {
        this.countryId();
        return false;
    });
    /** The first chips, and the chosen one wherever it is. */
    readonly chips = computed(() => {
        const categories = this.country()?.categories ?? [];
        if (this.allChips() || categories.length <= CHIP_LIMIT + 1) {
            return categories;
        }
        const shown = categories.slice(0, CHIP_LIMIT);
        const current = this.category();
        return current && !shown.includes(current)
            ? [...shown, current]
            : shown;
    });
    readonly hiddenChips = computed(
        () => (this.country()?.categories.length ?? 0) - this.chips().length
    );

    constructor() {
        this.countries.load();
    }

    choose(categoryId: string): void {
        this.chosen.set({ country: this.countryId(), id: categoryId });
    }

    play(channel: CountryChannel): void {
        this.countries.play(channel);
    }

    retry(): void {
        this.countries.load();
    }
}
