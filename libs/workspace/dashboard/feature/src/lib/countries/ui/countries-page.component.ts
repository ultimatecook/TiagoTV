import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    Injector,
    input,
    signal,
    untracked,
    viewChild,
    viewChildren,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsCatalogService } from '../../sports/sports-catalog.service';
import { findCountryDefinition } from '../countries';
import type { TvCountry } from '../countries-catalog';
import { CountriesCatalogService } from '../countries-catalog.service';
import type { CountryChannelGroup } from '../country-channels';
import type { TvRow } from '../country-rows';
import { CountryTvGuide } from '../country-tv-guide';
import { CountryTvPlayback } from '../country-tv-playback';
import {
    browserStorage,
    openingSelection,
    readLastChannel,
    selectionOf,
} from '../country-tv-start';
import {
    CountryTvRowComponent,
    type RowCrossing,
} from './country-tv-row.component';
import { CountryTvStageComponent } from './country-tv-stage.component';

/**
 * "Por países" (/workspace/countries) as a TV: the live player on top,
 * and under it each country's channels in sideways rows by kind
 * (Argentina, Spain, the United Kingdom, the United States). A tile plays
 * its channel in the player; nothing navigates. The page opens on the last
 * channel watched here, else on Argentina's first. A country's route
 * (`/workspace/countries/es`) opens on that country, scrolled to it.
 */
@Component({
    selector: 'lib-countries-page',
    imports: [
        CountryTvRowComponent,
        CountryTvStageComponent,
        MatIcon,
        TranslatePipe,
    ],
    providers: [CountryTvPlayback, CountryTvGuide],
    templateUrl: './countries-page.component.html',
    styleUrl: './countries-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountriesPageComponent {
    readonly catalog = inject(CountriesCatalogService);
    readonly tv = inject(CountryTvPlayback);
    private readonly sports = inject(SportsCatalogService);
    private readonly injector = inject(Injector);
    private readonly host: HTMLElement = inject(ElementRef).nativeElement;
    private readonly lanes = viewChild<ElementRef<HTMLElement>>('lanes');
    private readonly rows = viewChildren(CountryTvRowComponent);

    /** Bound from the route parameter, on a country's route. */
    readonly countryId = input<string>('');
    readonly countries = this.catalog.countries;
    readonly skeletonRows = [1, 2];
    /** The country the rows are scrolled to, lit in the jump bar. */
    readonly activeCountry = signal<string | null>(null);
    readonly selectedStreamId = computed(
        () => this.tv.selection()?.copy.streamId ?? null
    );
    private opened = false;
    private spyFrame = 0;

    constructor() {
        this.catalog.keepFresh(inject(DestroyRef));
        effect(() => {
            const countries = this.countries();
            if (countries && countries.length > 0 && !this.opened) {
                untracked(() => this.open(countries));
            }
        });
        inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.spyFrame));
    }

    play(country: TvCountry, row: TvRow, channel: CountryChannelGroup): void {
        this.tv.play(selectionOf(country, row, channel));
    }

    cross(from: CountryTvRowComponent, crossing: RowCrossing): void {
        const rows = this.rows();
        rows[rows.indexOf(from) + crossing.direction]?.focusNear(crossing.x);
    }

    /**
     * At once, not smoothly: a smooth jump to the US would pass every row
     * on the way, rendering each and loading its logos.
     */
    jumpTo(countryId: string): void {
        this.activeCountry.set(countryId);
        const section = this.host.querySelector<HTMLElement>(
            `[data-country="${countryId}"]`
        );
        const lanes = this.lanes()?.nativeElement;
        if (!section || !lanes) {
            return;
        }
        if (scrolls(lanes)) {
            const padding = parseFloat(getComputedStyle(lanes).paddingTop);
            lanes.scrollTo({ top: section.offsetTop - (padding || 0) });
        } else {
            section.scrollIntoView({ block: 'start' });
        }
    }

    /** The jump bar follows the rows: the country at the pane's top. */
    onLanesScroll(): void {
        cancelAnimationFrame(this.spyFrame);
        this.spyFrame = requestAnimationFrame(() => {
            const lanes = this.lanes()?.nativeElement;
            if (!lanes) {
                return;
            }
            const sections = Array.from(
                lanes.querySelectorAll<HTMLElement>('[data-country]')
            );
            const top = lanes.scrollTop + 48;
            const current = sections
                .filter((section) => section.offsetTop <= top)
                .pop();
            this.activeCountry.set(
                current?.dataset['country'] ??
                    sections[0]?.dataset['country'] ??
                    null
            );
        });
    }

    /** "Open in Live TV": the playing channel in the Xtream live view. */
    openLiveView(): void {
        const selection = this.tv.selection();
        if (!selection) {
            return;
        }
        // The live view plays it next: no hand-over to the mini-player.
        this.tv.leaving.set(true);
        const { copy, channel } = selection;
        this.sports.play({
            streamId: copy.streamId,
            categoryId: copy.categoryId,
            title: channel.title,
            icon: copy.icon,
        });
    }

    retry(): void {
        this.catalog.retry();
    }

    private open(countries: readonly TvCountry[]): void {
        this.opened = true;
        const countryId = findCountryDefinition(this.countryId())?.id ?? null;
        const selection = openingSelection(
            countries,
            readLastChannel(browserStorage()),
            countryId
        );
        this.activeCountry.set(
            countryId ?? countries[0]?.definition.id ?? null
        );
        if (selection) {
            this.tv.open(selection);
        }
        afterNextRender(
            () => {
                if (countryId) {
                    this.jumpTo(countryId);
                } else if (selection) {
                    this.reveal(selection.row.id);
                }
            },
            { injector: this.injector }
        );
    }

    /** The opening channel's row in view, if it is further down. */
    private reveal(rowId: string): void {
        const lanes = this.lanes()?.nativeElement;
        const row = this.host.querySelector<HTMLElement>(
            `[data-test-id="country-tv-row-${rowId}"]`
        );
        if (!lanes || !row || !scrolls(lanes)) {
            return;
        }
        const top = row.offsetTop;
        if (top > lanes.clientHeight * 0.6) {
            lanes.scrollTop = top - lanes.clientHeight / 3;
            this.onLanesScroll();
        }
    }
}

/** Whether the rows scroll in their own pane (not on a phone). */
function scrolls(element: HTMLElement): boolean {
    const overflow = getComputedStyle(element).overflowY;
    return overflow === 'auto' || overflow === 'scroll';
}
