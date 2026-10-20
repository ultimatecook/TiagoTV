import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    linkedSignal,
    untracked,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { titleKey } from '../../platforms/platform-titles';
import {
    buildCatalogRows,
    featuredTitle,
    NEW_RELEASES,
    pickNewReleases,
    type CatalogKind,
    type CatalogTitle,
} from '../catalog-titles';
import { CatalogService } from '../catalog.service';
import { CatalogHeroComponent } from './catalog-hero.component';
import { CatalogRowComponent } from './catalog-row.component';

const EXTRAS_DELAY_MS = 400;

/**
 * Series (/workspace/series) and Películas (/workspace/movies): every
 * platform's titles of the kind the route names (`data.kind`), merged
 * across platforms and languages. The hero features one of "Novedades"
 * (picking another features it), then one row per genre. No filters and
 * no search of its own: the app's search covers the catalog.
 */
@Component({
    selector: 'lib-catalog-page',
    imports: [CatalogHeroComponent, CatalogRowComponent, TranslatePipe],
    templateUrl: './catalog-page.component.html',
    styleUrl: './catalog-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[attr.data-kind]': 'kind()' },
})
export class CatalogPageComponent {
    private readonly catalog = inject(CatalogService);

    /** Bound from the route's data. */
    readonly kind = input<CatalogKind>('series');

    readonly titles = computed(() => this.catalog.titles(this.kind()));
    readonly status = computed(() => this.catalog.status(this.kind()));
    /** The platform that leads "Novedades": another each session. */
    private readonly lead = this.catalog.heroLead();
    readonly releases = computed(() =>
        pickNewReleases(this.titles() ?? [], NEW_RELEASES, this.lead)
    );
    readonly rows = computed(() => buildCatalogRows(this.titles() ?? []));
    /** The title the hero features: a picked release, else the first. */
    private readonly featuredKey = linkedSignal<CatalogKind, string | null>({
        source: this.kind,
        computation: () => null,
    });
    readonly featured = computed(() =>
        featuredTitle(this.releases(), this.titles() ?? [], this.featuredKey())
    );
    readonly headingKey = computed(() =>
        this.kind() === 'movie'
            ? 'WORKSPACE.CATALOG.MOVIES'
            : 'WORKSPACE.CATALOG.SERIES'
    );
    /** A first import takes longer than a read: the page says which. */
    readonly loadingKey = computed(() =>
        this.catalog.preparing(this.kind())
            ? 'WORKSPACE.CATALOG.PREPARING'
            : 'WORKSPACE.CATALOG.LOADING'
    );

    constructor() {
        effect(() => {
            const kind = this.kind();
            // Reloads when the source does (a new playlist, a first one).
            this.catalog.source();
            untracked(() => void this.catalog.load(kind));
        });
        // The first title featured stays until another is picked: while
        // the platforms' lists arrive, "Novedades" reshuffles (another
        // platform may lead it), and a hero swapping titles would ask the
        // provider for each one's page.
        effect(() => {
            const title = this.featured();
            if (title && titleKey(title) !== untracked(this.featuredKey)) {
                this.featuredKey.set(titleKey(title));
            }
        });
        // Its page once a title stays featured a moment.
        effect((onCleanup) => {
            const title = this.featured();
            if (title) {
                const timer = setTimeout(
                    () => this.catalog.loadExtras(title),
                    EXTRAS_DELAY_MS
                );
                onCleanup(() => clearTimeout(timer));
            }
        });
    }

    pick(title: CatalogTitle): void {
        this.featuredKey.set(titleKey(title));
    }
}
