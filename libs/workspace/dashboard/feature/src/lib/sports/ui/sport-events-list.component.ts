import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { kickOffTime } from '../match-days';
import { injectSportsLocale, matchSides } from '../match-view';
import { isFollowedTeam } from '../my-teams';
import { SportsBoardService } from '../sports-board.service';
import { SportsCatalogService } from '../sports-catalog.service';
import { competitionLogo, findSportSection } from '../sport-sections';
import type { SportMatch } from '../sports-catalog';

interface EventRow {
    readonly match: SportMatch;
    readonly sides: { readonly home: string; readonly away: string } | null;
    readonly live: boolean;
    readonly time: string;
    readonly competition: string;
    readonly logo: string | null;
    readonly tint: string;
    readonly homeMine: boolean;
    readonly awayMine: boolean;
    readonly channel: string;
}

/**
 * A list of matches in one card, a 60px row each (the Home's "today's
 * events" and the hub's "Later"): the kick-off, or a pulsing "Live"; the
 * competition; both sides, the followed teams in bold; the channel; and
 * Play, which opens the competition's page playing it.
 */
@Component({
    selector: 'lib-sport-events-list',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './sport-events-list.component.html',
    styleUrl: './sport-events-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportEventsListComponent {
    private readonly sports = inject(SportsCatalogService);
    private readonly board = inject(SportsBoardService);
    private readonly locale = injectSportsLocale();

    readonly matches = input.required<readonly SportMatch[]>();
    readonly rows = computed(() => {
        this.sports.now();
        const locale = this.locale();
        return this.matches().map((match): EventRow => {
            const section = findSportSection(match.sectionId);
            const kickOff = this.sports.kickOff(match);
            // Without the card's logo (the NBA's), its own competition.
            const logo = competitionLogo(section, match.event.competition);
            return {
                match,
                sides: matchSides(match),
                live: this.sports.isLive(match),
                time: kickOff ? kickOffTime(kickOff, locale) : '',
                competition:
                    section?.catchAll || logo !== section?.logo
                        ? match.event.competition
                        : (section?.title ?? match.event.competition),
                logo,
                tint: section?.tint ?? '#20232c',
                homeMine: isFollowedTeam(match.event.home),
                awayMine: isFollowedTeam(match.event.away),
                channel: match.channelName ?? '',
            };
        });
    });

    watch(match: SportMatch): void {
        this.board.openMatch(match);
    }
}
