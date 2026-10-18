import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsCatalogService } from '../sports-catalog.service';
import { findSportSection } from '../sport-sections';
import type { SportMatch } from '../sports-catalog';
import { TeamCrestComponent } from './team-crest.component';

/**
 * One match: both crests, the competition, and "EN VIVO" or the local
 * kick-off. Races and tennis sessions show their title on the
 * competition's artwork. A click plays the channel carrying it.
 */
@Component({
    selector: 'lib-sport-match-card',
    imports: [TeamCrestComponent, TranslatePipe],
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
    readonly live = computed(() => this.match().event.status === 'live');
    readonly kickOff = computed(() => {
        const start = this.match().event.start;
        return start
            ? start.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '';
    });

    play(): void {
        this.sports.play(this.match());
    }
}
