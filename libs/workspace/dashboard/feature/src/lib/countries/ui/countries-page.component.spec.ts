import { Component, signal } from '@angular/core';
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
import {
    EmbeddedMpvOverlayVisibilityService,
    NowPlayingDockService,
} from '@iptvnator/ui/playback';
import { SportsCatalogService } from '../../sports/sports-catalog.service';
import { buildCountriesTv, type TvCountry } from '../countries-catalog';
import { CountriesCatalogService } from '../countries-catalog.service';
import { CountryTvControls } from '../country-tv-controls';
import { CountryTvGuide } from '../country-tv-guide';
import { OVERLAY_IDLE_MS } from '../country-tv-idle';
import { CountryTvListings } from '../country-tv-listings';
import { CountryTvPlayback } from '../country-tv-playback';
import {
    COUNTRY_STORAGE_KEY,
    LAST_CHANNEL_STORAGE_KEY,
} from '../country-tv-start';
import { PageStateComponent } from '../../ui-state/page-state.component';
import {
    COUNTRIES_CATEGORY_MEMORY,
    CountriesPageComponent,
} from './countries-page.component';
import { CountryPickerComponent } from './country-picker.component';
import { CountryTvOverlayComponent } from './country-tv-overlay.component';

/** The picture without its web player. */
@Component({ selector: 'lib-country-tv-stage', template: '' })
class StageStub {}

const COUNTRIES = buildCountriesTv(
    [
        { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
        { category_id: 2, category_name: '|LAT|  ✪ ARGENTINA' },
        { category_id: 3, category_name: '|US| ✪ NEWS' },
        { category_id: 4, category_name: '|ES| ✪ NOTICIAS' },
    ],
    [
        { stream_id: 10, category_id: 1, name: '|ES| La 1' },
        { stream_id: 12, category_id: 1, name: '|ES| Antena 3' },
        { stream_id: 14, category_id: 4, name: '|ES| 24h' },
        { stream_id: 15, category_id: 4, name: '|ES| Euronews' },
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
        today: signal([]),
        isLive: () => true,
        play: jest.fn(),
    };

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
                    CountryPickerComponent,
                    CountryTvOverlayComponent,
                    MatIcon,
                    PageStateComponent,
                    StageStub,
                    TranslatePipe,
                ],
                providers: [
                    CountryTvPlayback,
                    CountryTvListings,
                    CountryTvControls,
                    {
                        provide: CountryTvGuide,
                        useValue: { nowNext: signal(null), nowOn: () => null },
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
    const controls = () => fixture.debugElement.injector.get(CountryTvControls);
    const element = () => fixture.nativeElement as HTMLElement;
    const find = (testId: string) =>
        element().querySelector<HTMLElement>(`[data-test-id="${testId}"]`);
    const card = (streamId: number) => find(`country-tv-card-${streamId}`);
    const cardIds = () =>
        Array.from(element().querySelectorAll<HTMLElement>('[data-card]')).map(
            (entry) => entry.dataset['testId']?.replace(/\D+/g, '')
        );
    const settle = async () => {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    };

    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        countries.set(COUNTRIES);
        hasSource.set(true);
        failed.set(false);
    });

    afterEach(() => jest.useRealTimers());

    it('plays Argentina’s first channel on opening, with its cards', async () => {
        await render();

        expect(tv().playback()?.streamUrl).toMatch(/\/21\.ts$/);
        expect(find('countries-playing')?.textContent?.trim()).toBe('Telefe');
        expect(find('countries-picker')?.textContent).toContain(
            'WORKSPACE.COUNTRIES.NAMES.AR'
        );
        expect(cardIds()).toEqual(['21', '20']);
        expect(card(21)?.getAttribute('aria-current')).toBe('true');
        expect(card(21)?.textContent).toContain('WORKSPACE.COUNTRIES.PLAYING');
        expect(catalog.keepFresh).toHaveBeenCalled();
    });

    it('plays a clicked card in place, without navigating', async () => {
        await render();

        card(20)?.click();
        await settle();

        expect(tv().playback()?.streamUrl).toMatch(/\/20\.ts$/);
        expect(card(20)?.getAttribute('aria-current')).toBe('true');
        expect(card(21)?.getAttribute('aria-current')).toBeNull();
        expect(sports.play).not.toHaveBeenCalled();
        expect(localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)).toBe('20');
    });

    it('switches country from its menu, and remembers it', async () => {
        await render();

        find('countries-picker')?.click();
        await settle();
        const options = Array.from(
            element().querySelectorAll<HTMLElement>('[data-country-option]')
        ).map((option) => option.dataset['testId']);
        // Spain, Argentina, the United States (no UK channels here).
        expect(options).toEqual([
            'countries-option-es',
            'countries-option-ar',
            'countries-option-us',
        ]);
        expect(find('countries-option-es')?.textContent).toContain(
            'WORKSPACE.COUNTRIES.CHANNELS'
        );

        find('countries-option-es')?.click();
        await settle();

        expect(find('countries-picker-menu')).toBeNull();
        expect(tv().playback()?.streamUrl).toMatch(/\/10\.ts$/);
        expect(cardIds()).toEqual(['10', '12', '14', '15']);
        expect(localStorage.getItem(COUNTRY_STORAGE_KEY)).toBe('es');
    });

    it('filters the cards by the chips, counting each', async () => {
        await render('es');

        const chips = Array.from(
            element().querySelectorAll<HTMLElement>('.chip')
        ).map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim());
        expect(chips).toEqual([
            'WORKSPACE.COUNTRIES.CATEGORIES.ALL 4',
            'WORKSPACE.COUNTRIES.CATEGORIES.MAIN 2',
            'WORKSPACE.COUNTRIES.CATEGORIES.NEWS 2',
        ]);

        find('countries-chip-news')?.click();
        await settle();
        expect(cardIds()).toEqual(['14', '15']);
        expect(find('countries-chip-news')?.getAttribute('aria-pressed')).toBe(
            'true'
        );
        // The playing channel keeps playing.
        expect(tv().playback()?.streamUrl).toMatch(/\/10\.ts$/);
    });

    it('keeps the chip on the history entry, for Back to bring it again', async () => {
        history.replaceState({ navigationId: 3 }, '');
        await render('es');
        find('countries-chip-news')?.click();
        await settle();
        // No new entry; the router's own keys stay.
        expect(history.state.navigationId).toBe(3);
        expect(history.state.tvPageMemory[COUNTRIES_CATEGORY_MEMORY]).toEqual({
            country: 'es',
            category: 'news',
        });

        // Back to the entry: the page opens on that chip again...
        TestBed.resetTestingModule();
        await render('es');
        expect(cardIds()).toEqual(['14', '15']);
        expect(find('countries-chip-news')?.getAttribute('aria-pressed')).toBe(
            'true'
        );

        // ...but another country's entry, or a new one, opens on "All".
        TestBed.resetTestingModule();
        history.replaceState({ navigationId: 4 }, '');
        await render('es');
        expect(cardIds()).toEqual(['10', '12', '14', '15']);
        history.replaceState(null, '');
    });

    it('opens again on the country chosen last, or the last channel', async () => {
        localStorage.setItem(LAST_CHANNEL_STORAGE_KEY, '30');
        await render();
        expect(tv().selection()?.channel.title).toBe('CNN');

        TestBed.resetTestingModule();
        localStorage.setItem(COUNTRY_STORAGE_KEY, 'es');
        await render();
        expect(tv().selection()?.channel.title).toBe('La 1');
    });

    it('opens a country’s route on that country', async () => {
        await render('es');
        expect(tv().playback()?.streamUrl).toMatch(/\/10\.ts$/);
        expect(find('countries-picker')?.textContent).toContain(
            'WORKSPACE.COUNTRIES.NAMES.ES'
        );
    });

    it('lets the overlay go while a channel plays, back on a key', async () => {
        await render();
        jest.useFakeTimers();
        const live = find('countries-live') as HTMLElement;

        jest.advanceTimersByTime(OVERLAY_IDLE_MS * 2);
        fixture.detectChanges();
        // Nothing plays yet (the video never said so): it stays.
        expect(live.classList).not.toContain('live--idle');

        controls().playing.set(true);
        fixture.detectChanges();
        jest.advanceTimersByTime(OVERLAY_IDLE_MS);
        fixture.detectChanges();
        expect(live.classList).toContain('live--idle');

        document.body.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Shift', bubbles: true })
        );
        fixture.detectChanges();
        expect(live.classList).not.toContain('live--idle');

        // Esc sends it away at once.
        document.body.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        fixture.detectChanges();
        expect(live.classList).toContain('live--idle');
    });

    describe('full screen', () => {
        const fullscreenIs = (element: Element | null) =>
            Object.defineProperty(document, 'fullscreenElement', {
                configurable: true,
                get: () => element,
            });
        const key = (target: EventTarget, name: string) =>
            target.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: name,
                    bubbles: true,
                    cancelable: true,
                })
            );

        beforeEach(() => {
            document.exitFullscreen = jest.fn(async () => undefined);
        });

        afterEach(() => fullscreenIs(null));

        it('leaves on F from the button just pressed, and on Esc', async () => {
            await render();
            const live = find('countries-live') as HTMLElement;
            live.requestFullscreen = jest.fn(async () => {
                fullscreenIs(live);
                document.dispatchEvent(new Event('fullscreenchange'));
            });
            const button = find('countries-fullscreen') as HTMLButtonElement;
            button.focus();
            button.click();
            await settle();
            expect(live.requestFullscreen).toHaveBeenCalled();
            expect(button.getAttribute('aria-pressed')).toBe('true');

            // The button keeps the focus: F there is still the page's.
            key(button, 'f');
            expect(document.exitFullscreen).toHaveBeenCalledTimes(1);

            // Where the window lets the page see Esc, it leaves too.
            key(button, 'Escape');
            expect(document.exitFullscreen).toHaveBeenCalledTimes(2);
        });

        it('hands full screen to a native-view Embedded MPV picture, and keeps the page clear of it', async () => {
            const release = jest.fn();
            await render();
            const overlays = TestBed.inject(
                EmbeddedMpvOverlayVisibilityService
            );
            const acquire = jest
                .spyOn(overlays, 'acquireExternalModalSurface')
                .mockReturnValue(release);
            const live = find('countries-live') as HTMLElement;
            // The engine the stage would render for Embedded MPV.
            const view = document.createElement('app-web-player-view');
            view.appendChild(document.createElement('app-embedded-mpv-player'));
            live.appendChild(view);
            view.requestFullscreen = jest.fn(async () => undefined);
            live.requestFullscreen = jest.fn(async () => undefined);
            await new Promise((resolve) => setTimeout(resolve));
            fixture.detectChanges();
            expect(live.classList).toContain('live--native');

            find('countries-fullscreen')?.click();
            expect(view.requestFullscreen).toHaveBeenCalled();
            expect(live.requestFullscreen).not.toHaveBeenCalled();

            // The country menu drops over the picture: it moves away.
            find('countries-picker')?.click();
            await settle();
            expect(acquire).toHaveBeenCalledTimes(1);
            find('countries-picker')?.click();
            await settle();
            expect(release).toHaveBeenCalled();
        });
    });

    it('opens the playing channel in the live view, without the mini-player', async () => {
        await render();

        find('countries-open-live')?.click();

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
        find('page-state-retry')?.click();
        expect(catalog.retry).toHaveBeenCalled();
        expect(tv().selection()).toBeNull();
    });
});
