import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsCatalogService } from '../sports-catalog.service';
import { SPORT_SECTIONS, type SportSectionId } from '../sport-sections';

/**
 * The Home's "Deportes" row: one tall card per competition, a player
 * cut-out standing on the competition's colour, its name across the
 * bottom (the Movistar+ sports menu). A card opens its competition.
 */
@Component({
    selector: 'lib-sports-rail',
    imports: [RouterLink, TranslatePipe],
    templateUrl: './sports-rail.component.html',
    styleUrl: './sports-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportsRailComponent {
    private readonly sports = inject(SportsCatalogService);

    readonly sections = SPORT_SECTIONS;
    private readonly liveCounts = computed(() => {
        const catalog = this.sports.catalog();
        const counts = new Map<SportSectionId, number>();
        for (const section of SPORT_SECTIONS) {
            counts.set(
                section.id,
                catalog?.[section.id].matches.filter(
                    (match) => match.event.status === 'live'
                ).length ?? 0
            );
        }
        return counts;
    });

    constructor() {
        void this.sports.load();
    }

    liveCount(id: SportSectionId): number {
        return this.liveCounts().get(id) ?? 0;
    }
}
