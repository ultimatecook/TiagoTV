import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import { SportsBoardService } from '../sports/sports-board.service';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import { HomeHeadingComponent } from './home-heading.component';
import {
    homeEventRow,
    homeEventsSummary,
    selectHomeEvents,
    type HomeEventRow,
} from './home-events';

/**
 * "Eventos de hoy": today's matches and events in one list card, the ones
 * on now first, football and the other sports alike (see `todaysMatches`).
 * A row opens its competition's page playing the match's feed
 * (`SportsBoardService.openMatch`). Hidden while there are none.
 */
@Component({
    selector: 'lib-home-events',
    imports: [HomeHeadingComponent, MatIcon, TranslatePipe],
    templateUrl: './home-events.component.html',
    styleUrl: './home-events.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeEventsComponent {
    private readonly sports = inject(SportsCatalogService);
    private readonly board = inject(SportsBoardService);
    private readonly translate = inject(TranslateService);
    private readonly languageTick = injectTranslationTick();

    readonly rows = computed<HomeEventRow[]>(() =>
        selectHomeEvents(this.sports.today()).map((match) =>
            homeEventRow(match, this.sports.isLive(match))
        )
    );

    /** "4 en vivo · 18 eventos". */
    readonly summary = computed(() => {
        this.languageTick();
        const { live, total } = homeEventsSummary(
            this.sports.today(),
            (match) => this.sports.isLive(match)
        );
        const events = this.translate.instant(
            total === 1
                ? 'WORKSPACE.DASHBOARD.EVENTS_ONE'
                : 'WORKSPACE.DASHBOARD.EVENTS_COUNT',
            { count: total }
        );
        return live > 0
            ? `${this.translate.instant('WORKSPACE.SPORTS.LIVE_COUNT', { count: live })} · ${events}`
            : events;
    });

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
    }

    kickOff(row: HomeEventRow): string {
        return row.kickOff
            ? row.kickOff.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
              })
            : '';
    }

    open(row: HomeEventRow): void {
        this.board.openMatch(row.match);
    }
}
