import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsBoardService } from '../sports-board.service';
import { SportsCatalogService } from '../sports-catalog.service';
import { SPORTS_ROW } from '../sport-sections';
import { RememberScrollDirective } from '../../ui-state/remember-scroll.directive';

/**
 * The league cards (the Home's "Deportes" row and the sports hub's): one
 * tall card per competition, a player cut-out standing on its colour with
 * the head over the card's top edge, its logo across the bottom, and a
 * glass pill counting its matches on now. A card opens its competition.
 */
@Component({
    selector: 'lib-sports-rail',
    imports: [RememberScrollDirective, RouterLink, TranslatePipe],
    templateUrl: './sports-rail.component.html',
    styleUrl: './sports-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportsRailComponent {
    readonly board = inject(SportsBoardService);
    readonly sections = SPORTS_ROW;
    /** The Home's "Deportes" heading with "See all"; the hub has its own. */
    readonly heading = input(true);

    constructor() {
        // The competition pages and today's matches read the same catalog.
        inject(SportsCatalogService).keepFresh(inject(DestroyRef));
    }
}
