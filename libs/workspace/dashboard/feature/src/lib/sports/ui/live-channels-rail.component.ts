import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SportsCatalogService } from '../sports-catalog.service';

/**
 * The Home's "Canales en vivo" row, under today's matches: the always-on
 * sports channels the source carries (ESPN, FOX Sports, TyC Sports…), one
 * logo tile each, like the platforms row. A tile plays the main feed.
 */
@Component({
    selector: 'lib-live-channels-rail',
    imports: [TranslatePipe],
    templateUrl: './live-channels-rail.component.html',
    styleUrl: './live-channels-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveChannelsRailComponent {
    readonly sports = inject(SportsCatalogService);

    constructor() {
        this.sports.keepFresh(inject(DestroyRef));
    }
}
