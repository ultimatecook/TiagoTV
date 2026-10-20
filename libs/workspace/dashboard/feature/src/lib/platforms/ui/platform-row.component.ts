import {
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    input,
    output,
    viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
    RANKED_DRESS,
    tileDress,
    type PlatformDesign,
} from '../platform-design';
import type { PlatformRow } from '../platform-rows';
import { PlatformTitleCardComponent } from './platform-title-card.component';
import { RememberScrollDirective } from '../../ui-state/remember-scroll.directive';

/** Posters a row lays out; "See all" opens the rest. */
const ROW_LIMIT = 40;

/**
 * One row of a platform's page, as the platforms draw theirs: a title
 * that opens the whole list, then tiles scrolling sideways, with arrows
 * at the edges for a mouse. The tiles share out the row's width, the
 * last one cut by the edge to show there is more; the featured row's
 * are a size up. A ranked row (Netflix's Top 10) sets each poster beside
 * its big outlined number.
 */
@Component({
    selector: 'lib-platform-row',
    imports: [
        PlatformTitleCardComponent,
        RememberScrollDirective,
        TranslatePipe,
    ],
    templateUrl: './platform-row.component.html',
    styleUrl: './platform-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[attr.data-look]': 'design().look',
        '[attr.data-tile]': 'tile()',
        '[attr.data-size]': "dress().large ? 'large' : null",
    },
})
export class PlatformRowComponent {
    readonly row = input.required<PlatformRow>();
    readonly design = input.required<PlatformDesign>();
    readonly seeAll = output<void>();

    readonly titles = computed(() => this.row().titles.slice(0, ROW_LIMIT));
    /** The cards' shape, size and dress: the design's, for this row. */
    readonly dress = computed(() =>
        this.row().ranked
            ? RANKED_DRESS
            : tileDress(this.design(), this.row().id)
    );
    readonly tile = computed(() =>
        this.row().ranked ? 'ranked' : this.dress().tile
    );
    private readonly track =
        viewChild.required<ElementRef<HTMLElement>>('track');

    scroll(direction: -1 | 1): void {
        const track = this.track().nativeElement;
        track.scrollBy({
            left: direction * track.clientWidth * 0.85,
            behavior: 'smooth',
        });
    }
}
