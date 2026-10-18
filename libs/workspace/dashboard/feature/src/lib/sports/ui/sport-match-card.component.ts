import { NgTemplateOutlet } from '@angular/common';
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
import { SportsCatalogService } from '../sports-catalog.service';
import { findSportSection } from '../sport-sections';
import type { SportChannel, SportMatch } from '../sports-catalog';
import { TeamCrestComponent } from './team-crest.component';

/**
 * One match: both crests, the competition, and "EN VIVO" or the local
 * kick-off. Races and tennis sessions show their title on the
 * competition's artwork. A click plays the channel carrying it; a match
 * no kept feed names says which of its competition's channels may show
 * it ("Ver en M+ LaLiga TV · DAZN LaLiga") and offers them.
 */
@Component({
    selector: 'lib-sport-match-card',
    imports: [
        MatIcon,
        MatMenuModule,
        NgTemplateOutlet,
        TeamCrestComponent,
        TranslatePipe,
    ],
    templateUrl: './sport-match-card.component.html',
    styleUrl: './sport-match-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportMatchCardComponent {
    private readonly sports = inject(SportsCatalogService);

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
        const start = this.match().event.start;
        return start
            ? start.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '';
    });
    /** "M+ LaLiga TV · DAZN LaLiga": where a match without a feed may be. */
    readonly watchOn = computed(() =>
        this.match()
            .via.slice(0, 2)
            .map((option) => option.name)
            .join(' · ')
    );
    /** Several channels may show it: the card offers them. */
    readonly offers = computed(() => this.match().via.length > 1);

    play(): void {
        // A match on its competition's only channel plays that channel.
        const match = this.match();
        this.sports.play(match.via[0]?.channel ?? match);
    }

    playChannel(channel: SportChannel): void {
        this.sports.play(channel);
    }
}
