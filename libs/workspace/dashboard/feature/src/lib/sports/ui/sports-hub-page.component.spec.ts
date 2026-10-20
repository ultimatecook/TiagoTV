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
import {
    SPORTS_DAY_MEMORY,
    SportsHubPageComponent,
} from './sports-hub-page.component';

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
        loading: signal(false),
        load: jest.fn(async () => undefined),
        keepFresh: jest.fn(),
        crests: { resolve: async () => null },
    };

    async function render() {
        TestBed.resetTestingModule();
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
    }

    afterEach(() => history.replaceState(null, ''));

    beforeEach(async () => {
        jest.clearAllMocks();
        catalog.set(CATALOG);
        sports.failed.set(false);
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
            query('[data-test-id="sports-later"] lib-page-state')?.textContent
        ).toContain('WORKSPACE.SPORTS.NO_MATCHES_DAY');
    });

    it('keeps the day picked on the history entry, for Back to bring it', async () => {
        history.replaceState({ navigationId: 7 }, '');
        query('[data-test-id="sports-day-1"]')?.click();
        // No new entry; the router's own keys stay.
        expect(history.state.navigationId).toBe(7);
        expect(history.state.tvPageMemory[SPORTS_DAY_MEMORY]).toBe(1);

        // Back to the entry: "Tomorrow" again, not "Today".
        await render();
        expect(
            query('[data-test-id="sports-day-1"]')?.getAttribute('aria-pressed')
        ).toBe('true');
        expect(query('[data-test-id="sports-live-now"]')).toBeNull();

        // A new entry opens on today.
        history.replaceState({ navigationId: 8 }, '');
        await render();
        expect(
            query('[data-test-id="sports-day-0"]')?.getAttribute('aria-pressed')
        ).toBe('true');
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

    it('opens a live match from anywhere on its card, as its button does', () => {
        const card = query('[data-test-id="sports-live-now"] lib-sport-match-card');
        card?.querySelector<HTMLElement>('.match__teams')?.click();
        expect(board.openMatch).toHaveBeenCalledTimes(1);
        expect(board.openMatch).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 1 }),
            undefined
        );

        // The button itself acts once, not twice.
        card?.querySelector<HTMLElement>('.match__watch')?.click();
        expect(board.openMatch).toHaveBeenCalledTimes(2);
    });

    it('plays a later match on its competition’s page', () => {
        all('[data-test-id="sports-later"] .event')[0].click();
        expect(board.openMatch).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 2 })
        );
    });

    it('waits for the catalog, or offers a retry when it failed', () => {
        catalog.set(null);
        fixture.detectChanges();
        expect(query('[data-test-id="sports-later"]')).toBeNull();
        expect(query('lib-page-state')?.textContent).toContain(
            'WORKSPACE.SPORTS.LOADING'
        );
        expect(query('[data-test-id="page-state-retry"]')).toBeNull();

        sports.failed.set(true);
        fixture.detectChanges();
        expect(query('[data-test-id="sports-failed"]')?.textContent).toContain(
            'WORKSPACE.SPORTS.FAILED'
        );
        query('[data-test-id="page-state-retry"]')?.click();
        expect(sports.load).toHaveBeenCalled();
    });
});
