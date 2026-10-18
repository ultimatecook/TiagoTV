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
import type { PlatformRow } from '../platform-titles';
import { PlatformTitleCardComponent } from './platform-title-card.component';

/** Posters a row lays out; "See all" opens the rest. */
const ROW_LIMIT = 40;

/**
 * One row of a platform's page, as the platforms draw theirs: a title
 * that opens the whole list, then posters scrolling sideways, with arrows
 * at the edges for a mouse.
 */
@Component({
    selector: 'lib-platform-row',
    imports: [PlatformTitleCardComponent, TranslatePipe],
    templateUrl: './platform-row.component.html',
    styleUrl: './platform-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformRowComponent {
    readonly row = input.required<PlatformRow>();
    readonly seeAll = output<void>();

    readonly titles = computed(() => this.row().titles.slice(0, ROW_LIMIT));
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
