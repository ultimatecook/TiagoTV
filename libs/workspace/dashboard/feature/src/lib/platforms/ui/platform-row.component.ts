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
import type { PlatformDesign } from '../platform-design';
import type { PlatformRow } from '../platform-titles';
import { PlatformTitleCardComponent } from './platform-title-card.component';

/** Posters a row lays out; "See all" opens the rest. */
const ROW_LIMIT = 40;

/**
 * One row of a platform's page, as the platforms draw theirs: a title
 * that opens the whole list, then tiles scrolling sideways, with arrows
 * at the edges for a mouse. A ranked row (Netflix's Top 10) sets each
 * poster beside its big outlined number.
 */
@Component({
    selector: 'lib-platform-row',
    imports: [PlatformTitleCardComponent, TranslatePipe],
    templateUrl: './platform-row.component.html',
    styleUrl: './platform-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[attr.data-look]': 'design().look',
        '[attr.data-tile]': 'tile()',
    },
})
export class PlatformRowComponent {
    readonly row = input.required<PlatformRow>();
    readonly design = input.required<PlatformDesign>();
    readonly seeAll = output<void>();

    readonly titles = computed(() => this.row().titles.slice(0, ROW_LIMIT));
    readonly tile = computed(() =>
        this.row().ranked ? 'ranked' : this.design().tiles
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
