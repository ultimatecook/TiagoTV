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
import type { SportChannel } from '../sports-catalog';
import { SportMatchCardComponent } from './sport-match-card.component';

/**
 * A competition's page (/workspace/sports/:sectionId): its matches on now
 * and later today, then its channels. Everything plays in the live player.
 */
@Component({
    selector: 'lib-sport-section-page',
    imports: [SportMatchCardComponent, TranslatePipe],
    templateUrl: './sport-section-page.component.html',
    styleUrl: './sport-section-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportSectionPageComponent {
    readonly sports = inject(SportsCatalogService);

    /** Bound from the route parameter. */
    readonly sectionId = input<string>('');
    readonly section = computed(() => findSportSection(this.sectionId()));
    readonly content = computed(() => {
        const section = this.section();
        const catalog = this.sports.catalog();
        return section && catalog ? catalog[section.id] : null;
    });
    readonly liveCount = computed(
        () =>
            this.content()?.matches.filter(
                (match) => match.event.status === 'live'
            ).length ?? 0
    );

    constructor() {
        void this.sports.load();
    }

    play(channel: SportChannel): void {
        this.sports.play(channel);
    }
}
