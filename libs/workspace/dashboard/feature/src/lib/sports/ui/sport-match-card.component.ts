import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { kickOffTime } from '../match-days';
import { injectSportsLocale, matchSides } from '../match-view';
import { isFollowedTeam } from '../my-teams';
import { SportsBoardService } from '../sports-board.service';
import { SportsCatalogService } from '../sports-catalog.service';
import { findSportSection } from '../sport-sections';
import type { SportChannel, SportMatch } from '../sports-catalog';
import { TeamCrestComponent } from './team-crest.component';

/**
 * One match on the competition's colour (the hub's "Live now"): the
 * competition and "Live" or the local kick-off, both crests and names
 * around "vs" (the provider names no score), and a white "Watch on
 * {channel}" that opens the competition's page playing it. A match no
 * kept feed names offers its competition's channels ("M+ LaLiga TV",
 * "DAZN LaLiga") in a menu. Races and tennis sessions show their title.
 */
@Component({
    selector: 'lib-sport-match-card',
    imports: [MatIcon, MatMenuModule, TeamCrestComponent, TranslatePipe],
    templateUrl: './sport-match-card.component.html',
    styleUrl: './sport-match-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportMatchCardComponent {
    private readonly sports = inject(SportsCatalogService);
    private readonly board = inject(SportsBoardService);
    private readonly locale = injectSportsLocale();

    readonly match = input.required<SportMatch>();
    readonly section = computed(() => findSportSection(this.match().sectionId));
    /** The card's name, or the match's own competition on "Resto del mundo". */
    readonly competition = computed(() => {
        const section = this.section();
        return section?.catchAll
            ? this.match().event.competition
            : (section?.title ?? '');
    });
    /** On now: a feed says "Live", or its kick-off has passed. */
    readonly live = computed(() => this.sports.isLive(this.match()));
    readonly kickOff = computed(() => {
        const start = this.sports.kickOff(this.match());
        return start ? kickOffTime(start, this.locale()) : '';
    });
    readonly sides = computed(() => matchSides(this.match()));
    readonly homeMine = computed(() => isFollowedTeam(this.match().event.home));
    readonly awayMine = computed(() => isFollowedTeam(this.match().event.away));
    readonly channel = computed(() => this.match().channelName ?? '');
    /** Several of its competition's channels may show it: a menu offers them. */
    readonly offers = computed(() => this.match().via.length > 1);

    watch(channel?: SportChannel): void {
        this.board.openMatch(this.match(), channel);
    }
}
