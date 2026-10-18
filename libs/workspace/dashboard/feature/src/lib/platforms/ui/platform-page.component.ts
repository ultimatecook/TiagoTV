import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    DOCUMENT,
    effect,
    inject,
    input,
    linkedSignal,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { buildPlatformRows } from '../platform-titles';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../streaming-platforms';
import { PlatformLogoComponent } from './platform-logo.component';
import { PlatformRowComponent } from './platform-row.component';
import { PlatformTitleCardComponent } from './platform-title-card.component';

/** Posters per page of a row's full list; "Show more" adds another. */
const PAGE = 60;

/**
 * A platform's page (/workspace/platforms/:platformId), laid out like the
 * platform's own: what is new, its movies, its series and its genres, one
 * row each. A row's title opens all of it.
 */
@Component({
    selector: 'lib-platform-page',
    imports: [
        PlatformLogoComponent,
        PlatformRowComponent,
        PlatformTitleCardComponent,
        TranslatePipe,
    ],
    templateUrl: './platform-page.component.html',
    styleUrl: './platform-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformPageComponent {
    readonly catalog = inject(PlatformsCatalogService);

    /** Bound from the route parameter. */
    readonly platformId = input<string>('');
    readonly platform = computed(() =>
        findStreamingPlatform(this.platformId())
    );
    readonly rows = computed(() => {
        const platform = this.platform();
        const titles = platform ? this.catalog.titlesOf(platform.id) : null;
        return titles ? buildPlatformRows(titles) : null;
    });

    /** The row shown whole, or null for the rows. */
    readonly openRowId = signal<string | null>(null);
    readonly openRow = computed(
        () => this.rows()?.find((row) => row.id === this.openRowId()) ?? null
    );
    readonly shown = linkedSignal({
        source: this.openRowId,
        computation: () => PAGE,
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
        tintGlassWithPlatform(this.platform);
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

/**
 * The glass takes the platform's colour while its page is open (Netflix
 * red, Prime blue…): the shell paints `--platform-ambient` under the
 * `platform-ambient` class.
 */
function tintGlassWithPlatform(platform: () => StreamingPlatform | null): void {
    const root = inject(DOCUMENT).documentElement;
    effect(() => {
        const colour = platform()?.ambient;
        root.classList.toggle('platform-ambient', !!colour);
        if (colour) {
            root.style.setProperty('--platform-ambient', colour);
        }
    });
    inject(DestroyRef).onDestroy(() =>
        root.classList.remove('platform-ambient')
    );
}
