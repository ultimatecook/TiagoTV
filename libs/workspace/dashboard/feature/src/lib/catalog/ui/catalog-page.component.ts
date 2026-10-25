import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    linkedSignal,
    untracked,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { titleKey } from '../../platforms/platform-titles';
import { HomeTitlePagesService } from '../../rails/home-title-pages.service';
import { CatalogHeroBackdropsService } from '../catalog-hero-backdrops.service';
import {
    buildCatalogRows,
    featuredTitle,
    NEW_RELEASES,
    pickNewReleases,
    type CatalogKind,
    type CatalogTitle,
} from '../catalog-titles';
import { CatalogService } from '../catalog.service';
import { PageStateComponent } from '../../ui-state/page-state.component';
import { CatalogHeroComponent } from './catalog-hero.component';
import { CatalogRowComponent } from './catalog-row.component';

const EXTRAS_DELAY_MS = 400;

/**
 * Series (/workspace/series) and Películas (/workspace/movies): every
 * platform's titles of the kind the route names (`data.kind`), merged
 * across platforms and languages. The hero features one of "Novedades"
 * (picking another features it), then one row per genre. No filters and
 * no search of its own: the app's search covers the catalog. The hero
 * features a title only over its backdrop, never its poster: the first
 * of "Novedades" with one, and a pick without one opens its page instead.
 */
@Component({
    selector: 'lib-catalog-page',
    imports: [
        CatalogHeroComponent,
        CatalogRowComponent,
        PageStateComponent,
        TranslatePipe,
    ],
    templateUrl: './catalog-page.component.html',
    styleUrl: './catalog-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[attr.data-kind]': 'kind()' },
})
export class CatalogPageComponent {
    private readonly catalog = inject(CatalogService);
    private readonly backdrops = inject(CatalogHeroBackdropsService);
    private readonly pages = inject(HomeTitlePagesService);
    /** The release last picked, while its page is asked for a backdrop. */
    private picking: string | null = null;

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
    /**
     * The title the hero features: a picked release, else the first, each
     * only with a backdrop that loads.
     */
    private readonly featuredKey = linkedSignal<CatalogKind, string | null>({
        source: this.kind,
        computation: () => null,
    });
    readonly featured = computed(() =>
        featuredTitle(
            this.releases(),
            this.titles() ?? [],
            this.featuredKey(),
            (title) => !!this.backdrops.backdropOf(title)
        )
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
        // No release with a backdrop known: a few of their pages, in turn.
        effect(() => {
            const releases = this.releases();
            if (releases.length > 0 && !this.featured()) {
                const kind = this.kind();
                untracked(() => this.backdrops.find(kind, releases));
            }
        });
        inject(DestroyRef).onDestroy(() => (this.picking = null));
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

    /**
     * Features the release picked once its backdrop is known (its page is
     * asked if need be); without one, its page opens instead.
     */
    pick(title: CatalogTitle): void {
        const key = titleKey(title);
        this.picking = key;
        if (this.backdrops.backdropOf(title)) {
            this.featuredKey.set(key);
            return;
        }
        void this.pages.fetch(title).then(() => {
            if (this.picking !== key) {
                return;
            }
            this.picking = null;
            if (this.backdrops.backdropOf(title)) {
                this.featuredKey.set(key);
            } else {
                this.catalog.open(title);
            }
        });
    }

    /** "Retry" on a failed load: the kind's lists are asked again. */
    retry(): void {
        void this.catalog.load(this.kind());
    }
}
