import { Component, input, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { buildCountriesTv } from '../../countries/countries-catalog';
import { CountriesCatalogService } from '../../countries/countries-catalog.service';
import type { SportMatch } from '../../sports/sports-catalog';
import { SportsCatalogService } from '../../sports/sports-catalog.service';
import { TeamCrestComponent } from '../../sports/ui/team-crest.component';
import { RECENT_SEARCHES_KEY } from '../search-recents';
import type { TitleHit } from '../search-results';
import { SearchTitlesService } from '../search-titles.service';
import {
    SEARCH_INPUT_DEBOUNCE_MS,
    SearchPageComponent,
} from './search-page.component';

/** The crest without its TheSportsDB lookup. */
@Component({ selector: 'lib-team-crest', template: '' })
class CrestStub {
    readonly team = input('');
    readonly section = input<string | null>(null);
}

const MATCH = {
    streamId: 1,
    categoryId: '10',
    title: 'Real Madrid - Barcelona',
    icon: null,
    key: 'laliga:rm:fcb',
    keys: [],
    sectionId: 'laliga',
    via: [],
    event: {
        status: 'live',
        title: 'Real Madrid - Barcelona',
        home: 'Real Madrid',
        away: 'Barcelona',
        competition: 'LaLiga',
        start: null,
        country: 'ES',
    },
} as unknown as SportMatch;

const COUNTRIES = buildCountriesTv(
    [{ category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' }],
    [
        { stream_id: 10, category_id: 1, name: '|ES| Telemadrid' },
        { stream_id: 11, category_id: 1, name: '|ES| La 1' },
    ],
    new Date('2026-10-18T18:00:00Z')
);

const SERIES: TitleHit = {
    key: 'series:gran hotel madrid',
    kind: 'series',
    title: 'Gran Hotel Madrid',
    year: 2024,
    platform: 'Netflix',
    poster: null,
    categoryId: '5',
    xtreamId: 55,
    rank: 1,
};

describe('SearchPageComponent', () => {
    let fixture: ComponentFixture<SearchPageComponent>;
    let router: Router;
    const titles = {
        source: signal({ _id: 'source-1' } as PlaylistMeta),
        search: jest.fn(),
    };
    const sports = {
        catalog: signal({ laliga: { matches: [MATCH], channels: [] } }),
        now: signal(new Date('2026-10-18T18:00:00Z')),
        upcoming: (matches: readonly SportMatch[]) => [...matches],
        isLive: () => true,
        keepFresh: jest.fn(),
        play: jest.fn(),
    };

    async function render(url = '/workspace/search') {
        TestBed.configureTestingModule({
            imports: [SearchPageComponent, TranslateModule.forRoot()],
            providers: [
                provideRouter([
                    {
                        path: 'workspace/search',
                        component: SearchPageComponent,
                    },
                ]),
                { provide: SportsCatalogService, useValue: sports },
                {
                    provide: CountriesCatalogService,
                    useValue: { countries: signal(COUNTRIES) },
                },
            ],
        });
        TestBed.overrideComponent(SearchPageComponent, {
            remove: { imports: [TeamCrestComponent] },
            add: {
                imports: [CrestStub],
                providers: [{ provide: SearchTitlesService, useValue: titles }],
            },
        });
        router = TestBed.inject(Router);
        await router.navigateByUrl(url);
        fixture = TestBed.createComponent(SearchPageComponent);
        await settle();
        return fixture.nativeElement as HTMLElement;
    }

    /**
     * Effects, the titles' promise and the render they cause. The search
     * awaits native promises, which fakeAsync cannot flush.
     */
    async function settle() {
        for (let round = 0; round < 4; round++) {
            fixture.detectChanges();
            await Promise.resolve();
            await Promise.resolve();
        }
        fixture.detectChanges();
    }

    const all = (element: HTMLElement, id: string) =>
        Array.from(element.querySelectorAll(`[data-test-id="${id}"]`));

    beforeEach(() => {
        titles.search.mockReset().mockResolvedValue({
            series: [SERIES],
            movies: [],
        });
        sports.play.mockReset();
        localStorage.clear();
    });

    it('shows the recent searches without a term', async () => {
        localStorage.setItem(
            RECENT_SEARCHES_KEY,
            JSON.stringify(['West Ham', 'The Bear'])
        );
        const element = await render();

        expect(
            all(element, 'search-recent-entry').map((entry) =>
                entry.textContent?.trim()
            )
        ).toEqual(['West Ham', 'The Bear']);
        expect(all(element, 'search-group-teams')).toHaveLength(0);
        expect(titles.search).not.toHaveBeenCalled();
    });

    it('groups the teams, channels and titles a `q` term finds', async () => {
        const element = await render('/workspace/search?q=madrid');

        expect(titles.search).toHaveBeenCalledWith('madrid', 'madrid');
        expect(all(element, 'search-team')).toHaveLength(1);
        expect(all(element, 'search-team')[0].textContent).toContain(
            'Real Madrid'
        );
        expect(all(element, 'search-channel')[0].textContent).toContain(
            'Telemadrid'
        );
        expect(all(element, 'search-title')[0].textContent).toContain(
            'Gran Hotel Madrid'
        );
        expect(all(element, 'search-empty')).toHaveLength(0);
    });

    it('narrows the groups to the chosen scope', async () => {
        const element = await render('/workspace/search?q=madrid');

        (
            element.querySelector(
                '[data-test-id="search-scope-channels"]'
            ) as HTMLButtonElement
        ).click();
        fixture.detectChanges();

        expect(all(element, 'search-group-teams')).toHaveLength(0);
        expect(all(element, 'search-group-titles')).toHaveLength(0);
        expect(all(element, 'search-group-channels')).toHaveLength(1);
    });

    it('writes the typed term to `q` after a pause, and Enter remembers it', async () => {
        const element = await render();
        const navigate = jest.spyOn(router, 'navigate');
        jest.useFakeTimers();
        const field = element.querySelector(
            '[data-test-id="search-page-input"]'
        ) as HTMLInputElement;

        field.value = 'tele';
        field.dispatchEvent(new Event('input'));
        expect(navigate).not.toHaveBeenCalled();
        jest.advanceTimersByTime(SEARCH_INPUT_DEBOUNCE_MS);
        jest.useRealTimers();
        expect(navigate).toHaveBeenCalledWith(
            [],
            expect.objectContaining({
                queryParams: { q: 'tele' },
                replaceUrl: true,
            })
        );

        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(
            JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]')
        ).toEqual(['tele']);
    });

    it('plays a channel it finds', async () => {
        const element = await render('/workspace/search?q=telemadrid');

        (all(element, 'search-channel')[0] as HTMLButtonElement).click();

        expect(sports.play).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 10, title: 'Telemadrid' })
        );
    });

    it('walks the field and the result rows with the arrow keys', async () => {
        const element = await render('/workspace/search?q=madrid');
        const field = element.querySelector(
            '[data-test-id="search-page-input"]'
        ) as HTMLInputElement;
        const rows = Array.from(
            element.querySelectorAll<HTMLElement>('.search-row')
        );
        const press = (target: HTMLElement, key: string) =>
            target.dispatchEvent(
                new KeyboardEvent('keydown', { key, bubbles: true })
            );

        press(field, 'ArrowDown');
        expect(document.activeElement).toBe(rows[0]);
        press(rows[0], 'ArrowDown');
        expect(document.activeElement).toBe(rows[1]);
        press(rows[1], 'ArrowUp');
        press(rows[0], 'ArrowUp');
        expect(document.activeElement).toBe(field);
    });

    it('says when nothing matches', async () => {
        titles.search.mockResolvedValue({ series: [], movies: [] });
        const element = await render('/workspace/search?q=zzzz');

        expect(all(element, 'search-empty')).toHaveLength(1);
    });
});
