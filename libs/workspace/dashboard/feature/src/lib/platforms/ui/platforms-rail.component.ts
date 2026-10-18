import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { PlatformLogoComponent } from './platform-logo.component';

/**
 * The Home's platforms row, above "Deportes": one logo card per streaming
 * platform the source carries. A card opens the platform's movies and
 * series in Spanish and English.
 */
@Component({
    selector: 'lib-platforms-rail',
    imports: [PlatformLogoComponent, RouterLink, TranslatePipe],
    templateUrl: './platforms-rail.component.html',
    styleUrl: './platforms-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformsRailComponent {
    private readonly catalog = inject(PlatformsCatalogService);

    readonly platforms = computed(() =>
        (this.catalog.shelves() ?? []).map((shelf) => shelf.platform)
    );

    constructor() {
        void this.catalog.loadShelves();
    }
}
