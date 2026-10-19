import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import { heroMeta } from '../catalog/catalog-meta';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogTitle } from '../catalog/catalog-titles';
import { titleKey } from '../platforms/platform-titles';
import { dashboardHeroHue } from './dashboard-hero.utils';
import { HomeHeadingComponent } from './home-heading.component';
import { HomeMyListService } from './home-my-list.service';
import { HomeNearDirective } from './home-near.directive';
import {
    metaLine,
    seriesBadge,
    seriesName,
    type HomeSeriesBadge,
} from './home-platform-titles';
import { HomePlatformTitlesService } from './home-platform-titles.service';

export interface HomeSeriesCard {
    readonly series: CatalogTitle;
    readonly key: string;
    readonly name: string;
    readonly image: string | null;
    readonly plot: string | null;
    /** "2024 · Crimen, Thriller · 2 temporadas", as the catalog writes it. */
    readonly meta: readonly string[];
    readonly badge: HomeSeriesBadge | null;
    /** The badge's label: "Nuevo episodio", "Temporada 2", "Estreno". */
    readonly badgeKey: string | null;
    readonly hue: number;
}

const BADGE_KEYS: Record<HomeSeriesBadge['kind'], string> = {
    'new-episode': 'WORKSPACE.DASHBOARD.BADGE_NEW_EPISODE',
    season: 'WORKSPACE.DASHBOARD.BADGE_SEASON',
    premiere: 'WORKSPACE.DASHBOARD.BADGE_PREMIERE',
};

/**
 * "Series para vos": an editorial grid of three of the platforms' newest
 * well rated shows (see `pickSeriesForYou`), the first large with its
 * synopsis and buttons, two stacked beside it. Badges only where the
 * catalog entry supports them (see `seriesBadge`).
 */
@Component({
    selector: 'lib-home-series',
    imports: [
        HomeHeadingComponent,
        HomeNearDirective,
        MatIcon,
        NgTemplateOutlet,
        TranslatePipe,
    ],
    templateUrl: './home-series.component.html',
    styleUrl: './home-series.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSeriesComponent {
    private readonly catalog = inject(CatalogService);
    private readonly myList = inject(HomeMyListService);
    private readonly translate = inject(TranslateService);
    private readonly languageTick = injectTranslationTick();
    readonly titles = inject(HomePlatformTitlesService);

    readonly cards = computed<HomeSeriesCard[]>(() => {
        this.languageTick();
        const translate = (key: string, params?: Record<string, unknown>) =>
            this.translate.instant(key, params);
        return this.titles.seriesForYou().map((series) => {
            const extras = this.catalog.extrasOf(series);
            const badge = seriesBadge(series);
            return {
                series,
                key: titleKey(series),
                name: seriesName(series),
                image: series.backdrop ?? extras?.backdrop ?? series.poster,
                plot: series.plot ?? extras?.plot ?? null,
                // Without the kind: the section already says "Series".
                meta: metaLine(heroMeta(series, extras).slice(1), translate),
                badge,
                badgeKey: badge ? BADGE_KEYS[badge.kind] : null,
                hue: dashboardHeroHue(series.title),
            };
        });
    });
    readonly featured = computed(() => this.cards()[0] ?? null);
    readonly side = computed(() => this.cards().slice(1, 3));
    readonly pending = computed(
        () => this.cards().length === 0 && this.titles.seriesPending()
    );

    constructor() {
        // The featured show's page gives its seasons (and a synopsis or
        // backdrop a stored row lacks); the two beside it are asked only
        // for a missing synopsis or backdrop. Also: which are on "Mi lista".
        effect(() => {
            const picks = this.titles.seriesForYou();
            const playlistId = this.catalog.source()?._id;
            untracked(() => {
                picks
                    .filter(
                        (series, index) =>
                            index === 0 || !series.plot || !series.backdrop
                    )
                    .forEach((series) => this.catalog.loadExtras(series));
                if (playlistId) {
                    void this.myList.check(playlistId, picks);
                }
            });
        });
    }

    saved(card: HomeSeriesCard): boolean {
        const playlistId = this.catalog.source()?._id;
        return !!playlistId && this.myList.isSaved(playlistId, card.series);
    }

    open(card: HomeSeriesCard): void {
        this.catalog.open(card.series);
    }

    async toggleMyList(card: HomeSeriesCard): Promise<void> {
        const playlistId = this.catalog.source()?._id;
        if (!playlistId) {
            return;
        }
        const saved = await this.myList.toggle(playlistId, card.series);
        if (saved === null) {
            // Not in the stored catalog: its page can add it.
            this.open(card);
        }
    }
}
