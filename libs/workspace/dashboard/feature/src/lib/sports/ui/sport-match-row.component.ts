import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { kickOffTime } from '../match-days';
import { injectSportsLocale, matchSides } from '../match-view';
import { isFollowedTeam } from '../my-teams';
import { SportsCatalogService } from '../sports-catalog.service';
import type { SportChannel, SportMatch } from '../sports-catalog';
import { teamGlow } from '../team-glow';
import { matchState } from './featured-match.component';
import { TeamCrestComponent } from './team-crest.component';

/**
 * One match of a competition's page ("Live and later"), an 84px row: the
 * time (green while on) and the day, both sides with their crests around
 * "vs", and the channel, which plays it on the page.
 */
@Component({
    selector: 'lib-sport-match-row',
    imports: [MatIcon, MatMenuModule, TeamCrestComponent, TranslatePipe],
    templateUrl: './sport-match-row.component.html',
    styleUrl: './sport-match-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportMatchRowComponent {
    private readonly sports = inject(SportsCatalogService);
    private readonly locale = injectSportsLocale();

    readonly match = input.required<SportMatch>();
    readonly watch = output<SportChannel>();

    readonly state = computed(() => {
        this.sports.now();
        return matchState(this.sports, this.match(), this.locale());
    });
    readonly sides = computed(() => matchSides(this.match()));
    /**
     * The kick-off beside "Live", when a feed announced it (a match first
     * seen on has only the time its feed was renamed, not its kick-off).
     */
    readonly liveSince = computed(() => {
        const start = this.match().event.start;
        return start ? kickOffTime(start, this.locale()) : '';
    });
    readonly homeMine = computed(() => isFollowedTeam(this.match().event.home));
    readonly awayMine = computed(() => isFollowedTeam(this.match().event.away));
    readonly homeGlow = computed(() => teamGlow(this.match().event.home));
    readonly awayGlow = computed(() => teamGlow(this.match().event.away));
    readonly channel = computed(() => this.match().channelName ?? '');
    readonly offers = computed(() => this.match().via.length > 1);

    play(channel?: SportChannel): void {
        const match = this.match();
        this.watch.emit(channel ?? match.via[0]?.channel ?? match);
    }
}
