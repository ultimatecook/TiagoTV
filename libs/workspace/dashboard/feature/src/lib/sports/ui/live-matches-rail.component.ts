import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsCatalogService } from '../sports-catalog.service';
import { SportMatchCardComponent } from './sport-match-card.component';

/**
 * The Home's "today" row: the matches on now, then today's kick-offs, of
 * the competitions the sports cards follow. Hidden while there are none.
 */
@Component({
    selector: 'lib-live-matches-rail',
    imports: [SportMatchCardComponent, TranslatePipe],
    template: `
        @if (sports.today().length > 0) {
            <section class="matches" data-test-id="dashboard-live-matches-rail">
                <header class="matches__heading">
                    <h2 class="matches__title">
                        {{ 'WORKSPACE.SPORTS.TODAY' | translate }}
                    </h2>
                </header>
                <div class="matches__row">
                    @for (match of sports.today(); track match.streamId) {
                        <lib-sport-match-card [match]="match" />
                    }
                </div>
            </section>
        }
    `,
    styles: `
        :host {
            display: block;
            min-width: 0;
        }

        .matches__heading {
            margin: 0 0 14px;
        }

        .matches__title {
            margin: 0;
            color: var(--app-heading-color);
            font-size: 22px;
            font-weight: 500;
        }

        .matches__row {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: clamp(260px, 22vw, 320px);
            gap: 16px;
            /* The row runs on to the window's edge, past the page gutter;
               the padding holds the cards' shadows, the negative margins
               give the room back to the layout. */
            padding: 4px var(--rail-bleed, 4px) 48px 12px;
            margin: -4px calc(-1 * var(--rail-bleed, 4px)) -34px -12px;
            scroll-padding-left: 12px;
            overflow-x: auto;
            scroll-snap-type: x proximity;
            scrollbar-width: none;

            &::-webkit-scrollbar {
                display: none;
            }

            > * {
                scroll-snap-align: start;
            }
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveMatchesRailComponent {
    readonly sports = inject(SportsCatalogService);

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
    }
}
