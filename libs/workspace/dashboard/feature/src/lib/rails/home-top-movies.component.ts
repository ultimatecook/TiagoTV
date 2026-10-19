import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import { posterMeta } from '../catalog/catalog-meta';
import { CatalogService } from '../catalog/catalog.service';
import type { CatalogTitle } from '../catalog/catalog-titles';
import { titleKey } from '../platforms/platform-titles';
import { dashboardHeroHue } from './dashboard-hero.utils';
import { HomeHeadingComponent } from './home-heading.component';
import { HomeNearDirective } from './home-near.directive';
import { metaLine } from './home-platform-titles';
import { HomePlatformTitlesService } from './home-platform-titles.service';

/** Placeholder cards while the catalog is read. */
const SKELETONS = [1, 2, 3, 4];

export interface HomeTopMovie {
    readonly movie: CatalogTitle;
    readonly key: string;
    readonly rank: number;
    readonly hue: number;
    /** "2020 · Acción · ★ 7.4": the catalog's poster line. */
    readonly meta: readonly string[];
}

/**
 * "Top 10 películas hoy · En tus plataformas": the best rated of the
 * platforms' newest movies (see `rankTopMovies`), each beside its big
 * outlined place number. The catalog is read once the section comes near.
 */
@Component({
    selector: 'lib-home-top-movies',
    imports: [HomeHeadingComponent, HomeNearDirective, TranslatePipe],
    templateUrl: './home-top-movies.component.html',
    styleUrl: './home-top-movies.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeTopMoviesComponent {
    private readonly catalog = inject(CatalogService);
    private readonly translate = inject(TranslateService);
    private readonly languageTick = injectTranslationTick();
    readonly titles = inject(HomePlatformTitlesService);
    readonly skeletons = SKELETONS;

    private readonly failedPosters = signal<ReadonlySet<string>>(new Set());

    readonly items = computed<HomeTopMovie[]>(() => {
        this.languageTick();
        const translate = (key: string, params?: Record<string, unknown>) =>
            this.translate.instant(key, params);
        return this.titles.topMovies().map((movie, index) => ({
            movie,
            key: titleKey(movie),
            rank: index + 1,
            hue: dashboardHeroHue(movie.title),
            meta: metaLine(posterMeta(movie, null), translate),
        }));
    });
    /** The section waits for the catalog only while it is still coming. */
    readonly pending = computed(
        () => this.items().length === 0 && this.titles.moviesPending()
    );

    posterOf(item: HomeTopMovie): string | null {
        const poster = item.movie.poster;
        return poster && !this.failedPosters().has(poster) ? poster : null;
    }

    markFailed(url: string): void {
        this.failedPosters.update((failed) => new Set(failed).add(url));
    }

    open(item: HomeTopMovie): void {
        this.catalog.open(item.movie);
    }
}
