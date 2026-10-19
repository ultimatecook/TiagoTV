import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HomeHeadingComponent } from '../../rails/home-heading.component';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { PlatformLogoComponent } from './platform-logo.component';

/**
 * The Home's platforms row, under "Seguir viendo": one logo card per
 * streaming platform the source carries (`PlatformsCatalogService`, whose
 * last loaded categories show at once). A card opens the platform's
 * movies and series in Spanish and English.
 */
@Component({
    selector: 'lib-platforms-rail',
    imports: [
        HomeHeadingComponent,
        PlatformLogoComponent,
        RouterLink,
        TranslatePipe,
    ],
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
