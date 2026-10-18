import { computed, type Signal } from '@angular/core';
import type {
    DashboardRailsSettings,
    PortalAddedItem,
} from '@iptvnator/shared/interfaces';
import type { DashboardRailCard } from './dashboard-rail.component';

/** Newest titles the "New & Popular" rail keeps for itself. */
const NEW_AND_POPULAR_RAIL_SHARE = 8;

/**
 * What the Home's first section reads from the dashboard; the rails
 * component satisfies it structurally, like the skeleton host.
 */
export interface DashboardFeatureSectionHost {
    readonly dashboardRails: () => DashboardRailsSettings;
    readonly continueWatchingCards: () => DashboardRailCard[];
    readonly favoriteMoviesAndSeriesCards: () => DashboardRailCard[];
    readonly xtreamRecentlyAddedCards: () => DashboardRailCard[];
    readonly heroSlides: {
        readonly slides: () => readonly unknown[];
        readonly loading: () => boolean;
    };
    readonly data: {
        readonly xtreamRecentlyAddedItems: () => readonly PortalAddedItem[];
    };
}

export interface DashboardFeatureSection {
    /** The tall cards beside the hero. */
    readonly sideCards: Signal<DashboardRailCard[]>;
    readonly headingKey: Signal<string>;
    readonly seeAllLink: Signal<string[]>;
    readonly visible: Signal<boolean>;
    /** The "New & Popular" page of the source the newest titles come from. */
    readonly newAndPopularLink: Signal<string[] | null>;
}

/**
 * The Home opens on "Continue Watching": the hero card, then the
 * unfinished titles as tall cards. A viewer without history still gets a
 * full first row — "Featured", with favourites or, failing those, the
 * newest titles past the ones "New & Popular" already shows.
 */
export function createDashboardFeatureSection(
    host: DashboardFeatureSectionHost
): DashboardFeatureSection {
    const continueWatching = computed(() =>
        host.dashboardRails().continueWatching
            ? host.continueWatchingCards()
            : []
    );
    const hasContinueWatching = computed(() => continueWatching().length > 0);

    const sideCards = computed(() => {
        if (hasContinueWatching()) {
            return continueWatching();
        }
        const favorites = host.dashboardRails().favoriteMoviesAndSeries
            ? host.favoriteMoviesAndSeriesCards()
            : [];
        return favorites.length > 0
            ? favorites
            : host.xtreamRecentlyAddedCards().slice(NEW_AND_POPULAR_RAIL_SHARE);
    });

    const newAndPopularLink = computed(() => {
        const newest = host.data.xtreamRecentlyAddedItems()[0];
        return newest
            ? ['/workspace', 'xtreams', newest.playlist_id, 'popular']
            : null;
    });

    return {
        sideCards,
        headingKey: computed(() =>
            hasContinueWatching()
                ? 'WORKSPACE.DASHBOARD.CONTINUE_WATCHING'
                : 'WORKSPACE.DASHBOARD.FEATURED'
        ),
        seeAllLink: computed(() =>
            hasContinueWatching()
                ? ['/workspace', 'global-recent']
                : (newAndPopularLink() ?? ['/workspace', 'global-recent'])
        ),
        visible: computed(
            () =>
                (host.dashboardRails().hero &&
                    (host.heroSlides.slides().length > 0 ||
                        host.heroSlides.loading())) ||
                sideCards().length > 0
        ),
        newAndPopularLink,
    };
}
