import { Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import {
    NowPlayingDockService,
    type NowPlayingHandoff,
} from '@iptvnator/ui/playback';
import type { LeagueTable } from '../league-tables';
import type { SignalCard } from '../signal-cards';
import {
    buildSportsCatalog,
    type SportChannel,
    type SportMatch,
} from '../sports-catalog';
import { SportsCatalogService } from '../sports-catalog.service';
import { SportTvGuide } from '../sport-tv-guide';
import { SportTvPlayback } from '../sport-tv-playback';
import { FeaturedMatchComponent } from './featured-match.component';
import { LeagueTableComponent } from './league-table.component';
import { SportMatchRowComponent } from './sport-match-row.component';
import { PageStateComponent } from '../../ui-state/page-state.component';
import { SportSectionPageComponent } from './sport-section-page.component';

/** The stage without its web player. */
@Component({ selector: 'lib-sport-stage', template: '' })
class StageStub {
    readonly section = input<unknown>();
    readonly cards = input<readonly SignalCard[]>([]);
    readonly liveCount = input(0);
    readonly more = output<void>();
}

const CATALOG = buildSportsCatalog(
    [
        { category_id: 1, category_name: '|ES| ✪ PREMIER LEAGUE PPV' },
        { category_id: 2, category_name: '|UK| ✪ SKY SPORTS' },
    ],
    [
        {
            stream_id: 1,
            category_id: 1,
            name: 'Live | Leeds United - Manchester United | Premier League | ES',
        },
        {
            stream_id: 2,
            category_id: 1,
            name: 'Next | 2099-10-18 | 15:30 (GMT) | Nottingham Forest - Arsenal | Premier League | ES',
        },
        {
            stream_id: 10,
            category_id: 2,
            name: 'UK: SKY SPORTS PREMIER LEAGUE HD',
        },
    ]
);

const HANDOFF: NowPlayingHandoff = {
    sessionKey: 'live-1',
    streamUrl: 'http://panel.test/live/u/p/1.ts',
    playback: null,
    title: 'Leeds United - Manchester United',
    subtitle: null,
    artworkUrl: null,
    startTime: 0,
    duration: 0,
    isLive: true,
    paused: false,
    volume: 1,
    muted: false,
    returnUrl: '/workspace/sports/premier-league',
    returnState: null,
};

const TABLE: LeagueTable = {
    rows: [
        {
            rank: 1,
            team: 'Manchester City',
            badge: null,
            played: 7,
            points: 19,
            form: ['W', 'W', 'D', 'W', 'W'],
            zone: 'champions',
        },
        {
            rank: 2,
            team: 'West Ham United',
            badge: null,
            played: 7,
            points: 16,
            form: ['W'],
            zone: null,
        },
    ],
    round: 7,
    group: null,
};

describe('SportSectionPageComponent', () => {
    let fixture: ComponentFixture<SportSectionPageComponent>;
    let resolveTable: (table: LeagueTable | null) => void;
    const tv = {
        open: jest.fn(),
        play: jest.fn(),
        clear: jest.fn(),
        dockedChannel: jest.fn(
            (_channels: readonly SportChannel[]): SportChannel | null => null
        ),
        selection: signal<SportChannel | null>(null),
    };
    const sports = {
        catalog: signal(CATALOG),
        now: signal(new Date(2026, 9, 18, 12)),
        upcoming: (matches: readonly SportMatch[]) => [...matches],
        isLive: (match: SportMatch) => match.event.status === 'live',
        kickOff: (match: SportMatch) => match.event.start,
        failed: signal(false),
        keepFresh: jest.fn(),
        crests: { resolve: async () => null },
        tables: {
            table: jest.fn(
                () =>
                    new Promise<LeagueTable | null>(
                        (done) => (resolveTable = done)
                    )
            ),
        },
    };

    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    async function render(sectionId: string, before?: () => void) {
        TestBed.configureTestingModule({
            imports: [SportSectionPageComponent, TranslateModule.forRoot()],
            providers: [{ provide: SportsCatalogService, useValue: sports }],
        });
        TestBed.overrideComponent(SportSectionPageComponent, {
            set: {
                imports: [
                    FeaturedMatchComponent,
                    LeagueTableComponent,
                    PageStateComponent,
                    SportMatchRowComponent,
                    StageStub,
                    TranslatePipe,
                ],
                providers: [
                    { provide: SportTvPlayback, useValue: tv },
                    { provide: SportTvGuide, useValue: {} },
                ],
            },
        });
        before?.();
        fixture = TestBed.createComponent(SportSectionPageComponent);
        fixture.componentRef.setInput('sectionId', sectionId);
        fixture.detectChanges();
        await fixture.whenStable();
    }

    const query = (selector: string) =>
        fixture.nativeElement.querySelector(selector) as HTMLElement | null;

    beforeEach(() => {
        jest.clearAllMocks();
        history.replaceState(null, '');
    });

    it('opens the first signal: the live match’s own feed', async () => {
        await render('premier-league');

        const stage = fixture.debugElement.query(
            (element) => element.componentInstance instanceof StageStub
        ).componentInstance as StageStub;
        expect(stage.cards().map((card) => card.channel.streamId)).toEqual([
            1, 10,
        ]);
        expect(tv.open).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 1 }),
            false
        );
    });

    it('opens the channel the way in asked for', async () => {
        history.replaceState(
            {
                tiagotvSportsPlay: {
                    streamId: 10,
                    categoryId: '2',
                    title: 'Sky Sports Premier League',
                    icon: null,
                },
            },
            ''
        );
        await render('premier-league');
        // Asked for: it plays even over another page's mini-player.
        expect(tv.open).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 10 }),
            true
        );
    });

    it('back from the mini-player, opens the channel it plays, not the way in’s', async () => {
        // In by "Ver en Sky" (10), then the user picked the other signal (1)
        // and left: the bar's way back replays the first request.
        const wayIn = {
            tiagotvSportsPlay: {
                streamId: 10,
                categoryId: '2',
                title: 'Sky Sports Premier League',
                icon: null,
            },
        };
        tv.dockedChannel.mockImplementation(
            (channels) => channels.find((c) => c.streamId === 1) ?? null
        );
        history.replaceState(wayIn, '');

        await render('premier-league', () =>
            TestBed.inject(NowPlayingDockService).handOff({
                ...HANDOFF,
                returnUrl: '/workspace/sports/premier-league',
                returnState: wayIn,
            })
        );

        expect(tv.open).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 1 }),
            false
        );
        tv.dockedChannel.mockImplementation(() => null);
    });

    it('drops the previous competition’s stream for one with no channel', async () => {
        await render('premier-league');
        expect(tv.clear).not.toHaveBeenCalled();

        // The route reuses the page for another competition.
        fixture.componentRef.setInput('sectionId', 'serie-a');
        fixture.detectChanges();
        await fixture.whenStable();

        expect(tv.clear).toHaveBeenCalledTimes(1);
    });

    it('shows the first match, the others, and the table beside them', async () => {
        await render('premier-league');

        expect(
            query('[data-test-id="sport-featured-match"]')?.textContent
        ).toContain('Leeds United');
        expect(query('lib-sport-match-row')?.textContent).toContain('Arsenal');
        expect(query('.page__table--loading')).not.toBeNull();

        resolveTable(TABLE);
        await fixture.whenStable();
        fixture.detectChanges();
        expect(query('.page__grid--table')).not.toBeNull();
        expect(query('.table__row--mine')?.textContent).toContain('West Ham');
        expect(query('[data-zone="champions"]')).not.toBeNull();
    });

    it('runs the matches across the page without a table', async () => {
        await render('premier-league');
        resolveTable(null);
        await fixture.whenStable();
        fixture.detectChanges();

        expect(query('.page__grid--table')).toBeNull();
        expect(query('lib-league-table')).toBeNull();
    });

    it('asks no table where the competition has none', async () => {
        await render('tennis');

        expect(sports.tables.table).not.toHaveBeenCalled();
        expect(query('.page__grid--table')).toBeNull();
        expect(query('lib-page-state')?.textContent).toContain(
            'WORKSPACE.SPORTS.NO_MATCHES'
        );
    });

    it('plays a match on the stage', async () => {
        await render('premier-league');
        query('lib-sport-match-row .row__watch')?.click();

        expect(tv.play).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 2 })
        );
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
});
