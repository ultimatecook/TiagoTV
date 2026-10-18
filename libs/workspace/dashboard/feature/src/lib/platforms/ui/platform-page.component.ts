import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    linkedSignal,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { buildBrandRows } from '../platform-brands';
import { platformDesign, rowTile } from '../platform-design';
import { PlatformThemeService } from '../platform-theme.service';
import { buildPlatformRows } from '../platform-titles';
import { findStreamingPlatform } from '../streaming-platforms';
import { PlatformBillboardComponent } from './platform-billboard.component';
import { PlatformBrandsComponent } from './platform-brands.component';
import { PlatformCarouselComponent } from './platform-carousel.component';
import { PlatformHeroComponent } from './platform-hero.component';
import { PlatformLogoComponent } from './platform-logo.component';
import { PlatformRowComponent } from './platform-row.component';
import { PlatformTitleCardComponent } from './platform-title-card.component';

/** Posters per page of a row's full list; "Show more" adds another. */
const PAGE = 60;

/**
 * A platform's page (/workspace/platforms/:platformId), laid out like the
 * platform's own app (`platformDesign`): Netflix's billboard, 16:9 tiles
 * and Top 10, Prime Video's carousel, HBO Max's posters, Apple TV's large
 * cards, Disney+'s carousel and brand tiles… Then what is new, its movies,
 * its series and its genres, one row each; a row's title opens all of it.
 */
@Component({
    selector: 'lib-platform-page',
    imports: [
        PlatformBillboardComponent,
        PlatformBrandsComponent,
        PlatformCarouselComponent,
        PlatformHeroComponent,
        PlatformLogoComponent,
        PlatformRowComponent,
        PlatformTitleCardComponent,
        TranslatePipe,
    ],
    templateUrl: './platform-page.component.html',
    styleUrl: './platform-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[attr.data-look]': 'design()?.look' },
})
export class PlatformPageComponent {
    readonly catalog = inject(PlatformsCatalogService);

    /** Bound from the route parameter. */
    readonly platformId = input<string>('');
    readonly platform = computed(() =>
        findStreamingPlatform(this.platformId())
    );
    readonly design = computed(() => {
        const platform = this.platform();
        return platform ? platformDesign(platform.id) : null;
    });
    readonly titles = computed(() => {
        const platform = this.platform();
        return platform ? this.catalog.titlesOf(platform.id) : null;
    });
    readonly rows = computed(() => {
        const titles = this.titles();
        const platform = this.platform();
        return titles && platform
            ? buildPlatformRows(titles, {
                  top10Of: this.design()?.top10 ? platform.name : undefined,
              })
            : null;
    });

    /** Disney+'s brands (Marvel, Star Wars…), each a list of its own. */
    readonly brandRows = computed(() => {
        const titles = this.titles();
        const platform = this.platform();
        return titles && platform && this.design()?.brands
            ? buildBrandRows(titles, platform.name)
            : [];
    });

    /** The row shown whole, or null for the rows. */
    readonly openRowId = signal<string | null>(null);
    readonly openRow = computed(() => {
        const id = this.openRowId();
        return (
            [...(this.rows() ?? []), ...this.brandRows()].find(
                (row) => row.id === id
            ) ?? null
        );
    });
    readonly shown = linkedSignal({
        source: this.openRowId,
        computation: () => PAGE,
    });
    /** The open row's tiles, Paramount+'s posters among its 16:9 rows. */
    readonly gridTile = computed(() => {
        const design = this.design();
        return design ? rowTile(design, this.openRowId() ?? '') : 'poster';
    });
    readonly visible = computed(
        () => this.openRow()?.titles.slice(0, this.shown()) ?? []
    );
    readonly hasMore = computed(
        () => (this.openRow()?.titles.length ?? 0) > this.shown()
    );

    constructor() {
        effect(() => {
            const platform = this.platform();
            if (platform) {
                void this.catalog.loadTitles(platform.id);
            }
        });
        // The glass takes the platform's colour while its page is open;
        // the app starts the theme too, this keeps the page whole alone.
        inject(PlatformThemeService).start();
    }

    openAll(rowId: string): void {
        this.openRowId.set(rowId);
    }

    backToRows(): void {
        this.openRowId.set(null);
    }

    showMore(): void {
        this.shown.update((count) => count + PAGE);
    }
}
