import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
    dayName,
    dayOffset,
    type DayName,
    DAY_OFFSETS,
    kickOffTime,
    matchDay,
    matchesOnDay,
} from '../match-days';
import { injectSportsLocale } from '../match-view';
import type { TeamFixture } from '../my-teams';
import { SportsBoardService } from '../sports-board.service';
import { SportsCatalogService } from '../sports-catalog.service';
import { SportEventsListComponent } from './sport-events-list.component';
import { SportMatchCardComponent } from './sport-match-card.component';
import { SportsRailComponent } from './sports-rail.component';
import { TeamCrestComponent } from './team-crest.component';

/** A followed team's state on its pill: on now, or its next kick-off. */
export type TeamStatus =
    | { readonly live: true }
    | { readonly live: false; readonly day: DayName; readonly time: string };

/**
 * The "Deportes" tab (/workspace/sports): the day picker, the league
 * cards, the followed teams, the matches on now and the day's others.
 * Every match opens its competition's page, playing it.
 */
@Component({
    selector: 'lib-sports-hub-page',
    imports: [
        SportEventsListComponent,
        SportMatchCardComponent,
        SportsRailComponent,
        TeamCrestComponent,
        TranslatePipe,
    ],
    templateUrl: './sports-hub-page.component.html',
    styleUrl: './sports-hub-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportsHubPageComponent {
    readonly sports = inject(SportsCatalogService);
    readonly board = inject(SportsBoardService);
    private readonly locale = injectSportsLocale();

    /** The day picked: days from today. */
    readonly offset = signal(0);
    readonly days = computed(() => {
        const now = this.sports.now();
        const locale = this.locale();
        return DAY_OFFSETS.map((offset) => ({
            offset,
            name: dayName(offset, matchDay(now, offset).start, locale),
        }));
    });
    /** "Later" for today, else the day's name. */
    readonly dayTitle = computed<DayName>(() =>
        this.offset() === 0
            ? { key: 'WORKSPACE.SPORTS.LATER', text: '' }
            : (this.days().find((day) => day.offset === this.offset())
                  ?.name ?? { key: null, text: '' })
    );
    /** Today's matches on now (shown on today only). */
    readonly live = computed(() =>
        this.sports.today().filter((match) => this.sports.isLive(match))
    );
    /** The day's matches; today's not on yet. */
    readonly later = computed(() => {
        const catalog = this.sports.catalog();
        if (!catalog) {
            return [];
        }
        const now = this.sports.now();
        const offset = this.offset();
        const matches = matchesOnDay(
            catalog,
            matchDay(now, offset),
            now,
            (match) => this.sports.kickOff(match)
        );
        return offset === 0
            ? matches.filter((match) => !this.sports.isLive(match))
            : matches;
    });
    readonly teams = computed(() =>
        this.board.teams().map((fixture) => ({
            fixture,
            status: this.statusOf(fixture),
        }))
    );

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
    }

    openTeam(fixture: TeamFixture): void {
        if (fixture.match) {
            this.board.openMatch(fixture.match);
        } else {
            this.board.open(fixture.team.sectionId);
        }
    }

    private statusOf(fixture: TeamFixture): TeamStatus | null {
        const match = fixture.match;
        if (!match) {
            return null;
        }
        if (this.sports.isLive(match)) {
            return { live: true };
        }
        const kickOff = this.sports.kickOff(match);
        if (!kickOff) {
            return null;
        }
        const locale = this.locale();
        const offset = dayOffset(kickOff, this.sports.now());
        return {
            live: false,
            day: dayName(offset, kickOff, locale),
            time: kickOffTime(kickOff, locale),
        };
    }
}
