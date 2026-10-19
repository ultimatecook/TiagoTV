import { Component, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { UnifiedRecentDataService } from '@iptvnator/portal/shared/data-access';
import { PORTAL_PLAYER } from '@iptvnator/portal/shared/util';
import {
    XtreamStore,
    XtreamUrlService,
} from '@iptvnator/portal/xtream/data-access';
import { PlaybackHistoryGate } from '@iptvnator/playback/data-access';
import { ParentalLockService } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { NowPlayingDockService } from '@iptvnator/ui/playback';
import { SportsCatalogService } from '../../sports/sports-catalog.service';
import { buildCountriesTv, type TvCountry } from '../countries-catalog';
import { CountriesCatalogService } from '../countries-catalog.service';
import { CountryTvGuide } from '../country-tv-guide';
import { CountryTvPlayback } from '../country-tv-playback';
import { LAST_CHANNEL_STORAGE_KEY } from '../country-tv-start';
import { CountriesPageComponent } from './countries-page.component';
import { CountryTvRowComponent } from './country-tv-row.component';

/** The stage without its web player. */
@Component({ selector: 'lib-country-tv-stage', template: '' })
class StageStub {
    readonly openLiveView = output<void>();
}

const COUNTRIES = buildCountriesTv(
    [
        { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
        { category_id: 2, category_name: '|LAT|  ✪ ARGENTINA' },
        { category_id: 3, category_name: '|US| ✪ NEWS' },
    ],
    [
        { stream_id: 10, category_id: 1, name: '|ES| La 1' },
        { stream_id: 12, category_id: 1, name: '|ES| Antena 3' },
        { stream_id: 20, category_id: 2, name: '|ARG| C5N' },
        { stream_id: 21, category_id: 2, name: '|ARG| TELEFE' },
        { stream_id: 30, category_id: 3, name: '|US| CNN' },
    ],
    new Date('2026-10-18T18:00:00Z')
);

describe('CountriesPageComponent', () => {
    let fixture: ComponentFixture<CountriesPageComponent>;
    const countries = signal<TvCountry[] | null>(null);
    const hasSource = signal(true);
    const failed = signal(false);
    const catalog = {
        countries,
        hasSource,
        failed,
        loading: signal(false),
        keepFresh: jest.fn(),
        retry: jest.fn(),
    };
    const sports = {
        source: signal({
            _id: 'source-1',
            serverUrl: 'http://panel.test',
            username: 'user',
            password: 'secret',
        } as PlaylistMeta),
        play: jest.fn(),
    };

    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
        Element.prototype.scrollTo = jest.fn();
    });

    async function render(countryId = '') {
        TestBed.configureTestingModule({
            imports: [CountriesPageComponent, TranslateModule.forRoot()],
            providers: [
                { provide: CountriesCatalogService, useValue: catalog },
                { provide: SportsCatalogService, useValue: sports },
                {
                    provide: XtreamUrlService,
                    useValue: {
                        constructLiveUrl: (_: unknown, id: number) =>
                            `http://panel.test/live/user/secret/${id}.ts`,
                        constructAutoLiveTsUrl: () => undefined,
                    },
                },
                {
                    provide: XtreamStore,
                    useValue: { currentPlaylist: signal(null) },
                },
                {
                    provide: PORTAL_PLAYER,
                    useValue: { isEmbeddedPlayer: () => true },
                },
                {
                    provide: PlaybackHistoryGate,
                    useValue: { defer: jest.fn() },
                },
                { provide: UnifiedRecentDataService, useValue: {} },
                {
                    provide: ParentalLockService,
                    useValue: {
                        version: signal(0),
                        isXtreamCategoryLocked: () => false,
                    },
                },
                {
                    provide: NowPlayingDockService,
                    useValue: { session: signal(null) },
                },
            ],
        });
        TestBed.overrideComponent(CountriesPageComponent, {
            set: {
                imports: [
                    CountryTvRowComponent,
                    MatIcon,
                    StageStub,
                    TranslatePipe,
                ],
                providers: [
                    CountryTvPlayback,
                    {
                        provide: CountryTvGuide,
                        useValue: { nowNext: signal(null) },
                    },
                ],
            },
        });
        fixture = TestBed.createComponent(CountriesPageComponent);
        fixture.componentRef.setInput('countryId', countryId);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    const tv = () => fixture.debugElement.injector.get(CountryTvPlayback);
    const element = () => fixture.nativeElement as HTMLElement;
    const tile = (streamId: number) =>
        element().querySelector<HTMLElement>(
            `[data-test-id="country-tv-tile-${streamId}"]`
        );

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        countries.set(COUNTRIES);
        hasSource.set(true);
        failed.set(false);
    });

    it('plays Argentina’s first channel on opening, its rows in order', async () => {
        await render();

        expect(tv().playback()?.streamUrl).toMatch(/\/21\.ts$/);
        const sections = Array.from(
            element().querySelectorAll('[data-country]')
        ).map((section) => section.getAttribute('data-country'));
        expect(sections).toEqual(['ar', 'es', 'us']);
        expect(tile(21)?.getAttribute('aria-current')).toBe('true');
        expect(catalog.keepFresh).toHaveBeenCalled();
    });

    it('plays a clicked tile in the player above, without navigating', async () => {
        await render();

        tile(12)?.click();
        fixture.detectChanges();

        expect(tv().playback()?.streamUrl).toMatch(/\/12\.ts$/);
        expect(tv().selection()?.country.definition.id).toBe('es');
        expect(tile(12)?.getAttribute('aria-current')).toBe('true');
        expect(tile(21)?.getAttribute('aria-current')).toBeNull();
        expect(sports.play).not.toHaveBeenCalled();
        expect(localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)).toBe('12');
    });

    it('opens again on the last channel watched here', async () => {
        localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, '30');
        await render();
        expect(tv().selection()?.channel.title).toBe('CNN');
    });

    it('opens a country’s route on that country', async () => {
        await render('es');
        expect(tv().playback()?.streamUrl).toMatch(/\/10\.ts$/);
        expect(
            element()
                .querySelector('[data-test-id="countries-jump-es"]')
                ?.getAttribute('aria-current')
        ).toBe('true');
    });

    it('opens the playing channel in the live view, without the mini-player', async () => {
        await render();

        fixture.componentInstance.openLiveView();

        expect(tv().leaving()).toBe(true);
        expect(sports.play).toHaveBeenCalledWith({
            streamId: 21,
            categoryId: '2',
            title: 'Telefe',
            icon: null,
        });
    });

    it('says when there is no source, or offers a retry', async () => {
        countries.set(null);
        hasSource.set(false);
        await render();
        expect(element().textContent).toContain(
            'WORKSPACE.COUNTRIES.NO_SOURCE'
        );

        hasSource.set(true);
        failed.set(true);
        fixture.detectChanges();
        element().querySelector<HTMLButtonElement>('.state__retry')?.click();
        expect(catalog.retry).toHaveBeenCalled();
        expect(tv().selection()).toBeNull();
    });
});
