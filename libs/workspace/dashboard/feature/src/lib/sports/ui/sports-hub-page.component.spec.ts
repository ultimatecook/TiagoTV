import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { teamFixtures } from '../my-teams';
import { SportsBoardService } from '../sports-board.service';
import {
    buildSportsCatalog,
    todaysMatches,
    type SportMatch,
    type SportsCatalog,
} from '../sports-catalog';
import { SportsCatalogService } from '../sports-catalog.service';
import { SportsHubPageComponent } from './sports-hub-page.component';

const NOW = new Date(2026, 9, 18, 12, 0);
const pad = (value: number) => String(value).padStart(2, '0');
/** "Next | <date> | <time> (GMT) | …", `hours` after NOW. */
function next(hours: number, teams: string, competition: string): string {
    const at = new Date(NOW.getTime() + hours * 3600_000);
    const date = `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
    return `Next | ${date} | ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())} (GMT) | ${teams} | ${competition} | ES`;
}

const CATALOG = buildSportsCatalog(
    [{ category_id: 1, category_name: '|ES| ✪ DAZN EVENT' }],
    [
        {
            stream_id: 1,
            category_id: 1,
            name: 'Live | Getafe CF - Real Madrid | LaLiga | ES',
        },
        {
            stream_id: 2,
            category_id: 1,
            name: next(6, 'West Ham United - Arsenal', 'Premier League'),
        },
        {
            stream_id: 3,
            category_id: 1,
            name: next(27, 'Juventus - Lazio', 'Serie A'),
        },
    ],
    NOW
);

describe('SportsHubPageComponent', () => {
    let fixture: ComponentFixture<SportsHubPageComponent>;
    const catalog = signal<SportsCatalog | null>(CATALOG);
    const isLive = (match: SportMatch) => match.event.status === 'live';
    const board = {
        liveCounts: signal(new Map([['laliga', 1]])),
        teams: signal(
            teamFixtures([
                ...CATALOG.laliga.matches,
                ...CATALOG['premier-league'].matches,
            ])
        ),
        open: jest.fn(),
        openMatch: jest.fn(),
    };
    const sports = {
        catalog,
        now: signal(NOW),
        today: () => {
            const value = catalog();
            return value ? todaysMatches(value, NOW) : [];
        },
        isLive,
        isOver: () => false,
        kickOff: (match: SportMatch) => match.event.start,
        failed: signal(false),
        keepFresh: jest.fn(),
        crests: { resolve: async () => null },
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        catalog.set(CATALOG);
        TestBed.configureTestingModule({
            imports: [SportsHubPageComponent, TranslateModule.forRoot()],
            providers: [
                provideRouter([]),
                { provide: SportsCatalogService, useValue: sports },
                { provide: SportsBoardService, useValue: board },
            ],
        });
        fixture = TestBed.createComponent(SportsHubPageComponent);
        fixture.detectChanges();
        await fixture.whenStable();
    });

    const query = (selector: string) =>
        fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    const all = (selector: string) =>
        Array.from(
            fixture.nativeElement.querySelectorAll(selector)
        ) as HTMLElement[];

    it('opens on today: the league cards, live now and later', () => {
        expect(all('.days__day')).toHaveLength(5);
        expect(
            query('[data-test-id="sports-day-0"]')?.getAttribute('aria-pressed')
        ).toBe('true');
        expect(all('lib-sports-rail .sport')).toHaveLength(14);
        expect(
            query(
                '[data-test-id="sport-card-live-laliga"]'
            )?.textContent?.trim()
        ).toBe('1');
        expect(
            all('[data-test-id="sports-live-now"] lib-sport-match-card')
        ).toHaveLength(1);
        const later = all('[data-test-id="sports-later"] .event');
        expect(later.map((row) => row.textContent)).toEqual([
            expect.stringContaining('West Ham United'),
        ]);
    });

    it('lists another day’s matches, or says it has none', async () => {
        query('[data-test-id="sports-day-1"]')?.click();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(query('[data-test-id="sports-live-now"]')).toBeNull();
        expect(
            all('[data-test-id="sports-later"] .event').map(
                (row) => row.textContent
            )
        ).toEqual([expect.stringContaining('Juventus')]);

        query('[data-test-id="sports-day--1"]')?.click();
        fixture.detectChanges();
        expect(
            query('[data-test-id="sports-later"] .block__empty')
        ).not.toBeNull();
    });

    it('shows each followed team’s state and opens its match', () => {
        const pills = all('.team');
        expect(
            pills.map((pill) => pill.textContent?.replace(/\s+/g, ' ').trim())
        ).toEqual([
            expect.stringContaining('WORKSPACE.SPORTS.LIVE'),
            expect.stringContaining("Newell's Old Boys"),
            expect.stringMatching(
                /West Ham United\s*WORKSPACE\.SPORTS\.DAYS\.TODAY · \d/
            ),
        ]);

        pills[0].click();
        expect(board.openMatch).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 1 })
        );
        pills[1].click();
        expect(board.open).toHaveBeenCalledWith('liga-argentina');
    });

    it('plays a later match on its competition’s page', () => {
        all('[data-test-id="sports-later"] .event')[0].click();
        expect(board.openMatch).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 2 })
        );
    });

    it('waits for the catalog', () => {
        catalog.set(null);
        fixture.detectChanges();
        expect(query('[data-test-id="sports-later"]')).toBeNull();
        expect(query('.block__empty')?.textContent).toContain(
            'WORKSPACE.SPORTS.LOADING'
        );
    });
});
