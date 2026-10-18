import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsCatalogService } from '../sports-catalog.service';
import { SPORT_SECTIONS } from '../sport-sections';

/**
 * The Home's "Deportes" row: one tall card per competition, a player
 * cut-out standing on the competition's colour, its logo across the
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
    readonly sections = SPORT_SECTIONS;

    constructor() {
        // The competition pages and today's matches read the same catalog.
        inject(SportsCatalogService).keepFresh(inject(DestroyRef));
    }
}
