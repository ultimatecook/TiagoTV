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
import { dayName, dayOffset, kickOffTime, type DayName } from '../match-days';
import { injectSportsLocale, matchSides } from '../match-view';
import { SportsCatalogService } from '../sports-catalog.service';
import { competitionLogo, type SportSection } from '../sport-sections';
import type { SportChannel, SportMatch } from '../sports-catalog';
import { teamGlow } from '../team-glow';
import { TeamCrestComponent } from './team-crest.component';

/** "Live", or the kick-off's day and time. */
export type MatchState =
    | { readonly live: true }
    | { readonly live: false; readonly day: DayName; readonly time: string };

/** A match's state on a competition's page. */
export function matchState(
    sports: Pick<SportsCatalogService, 'isLive' | 'kickOff' | 'now'>,
    match: SportMatch,
    locale?: string
): MatchState | null {
    if (sports.isLive(match)) {
        return { live: true };
    }
    const kickOff = sports.kickOff(match);
    return kickOff
        ? {
              live: false,
              day: dayName(dayOffset(kickOff, sports.now()), kickOff, locale),
              time: kickOffTime(kickOff, locale),
          }
        : null;
}

/**
 * A competition page's first match (on now, else the next), across the
 * page: both crests, the state, "vs" (the provider names no score) and
 * "Watch on {channel}", on the competition's colour lit by each side's.
 */
@Component({
    selector: 'lib-featured-match',
    imports: [MatIcon, MatMenuModule, TeamCrestComponent, TranslatePipe],
    templateUrl: './featured-match.component.html',
    styleUrl: './featured-match.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedMatchComponent {
    private readonly sports = inject(SportsCatalogService);
    private readonly locale = injectSportsLocale();

    readonly match = input.required<SportMatch>();
    readonly section = input.required<SportSection>();
    readonly watch = output<SportChannel>();

    readonly state = computed(() => {
        this.sports.now();
        return matchState(this.sports, this.match(), this.locale());
    });
    readonly sides = computed(() => matchSides(this.match()));
    /** The watermark: the card's logo, unless another's (the NBA's). */
    readonly logo = computed(() =>
        competitionLogo(this.section(), this.match().event.competition)
    );
    readonly homeGlow = computed(() => teamGlow(this.match().event.home));
    readonly awayGlow = computed(() => teamGlow(this.match().event.away));
    readonly channel = computed(() => this.match().channelName ?? '');
    readonly offers = computed(() => this.match().via.length > 1);

    play(channel?: SportChannel): void {
        const match = this.match();
        this.watch.emit(channel ?? match.via[0]?.channel ?? match);
    }
}
