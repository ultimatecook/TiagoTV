import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import {
    ContentCardComponent,
    ContentRailShellComponent,
} from '@iptvnator/portal/shared/ui';
import { toXtreamRecentlyAddedTimestamp } from '@iptvnator/shared/interfaces';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { ContentType } from '@iptvnator/portal/xtream/data-access';

interface RecentlyAddedItem {
    readonly added?: string;
    readonly category_id: string | number;
    readonly cover?: string;
    readonly id?: number;
    readonly last_modified?: string;
    readonly name?: string;
    readonly poster_url?: string;
    readonly rating?: string | number;
    readonly rating_5based?: string | number;
    readonly series_id?: number;
    readonly stream_id?: number;
    readonly stream_icon?: string;
    readonly title?: string;
    readonly xtream_id?: number;
}

// Three placeholder slots per skeleton rail — enough to suggest a horizontal
// scroll without taking the whole viewport.
const SKELETON_CARDS_PER_RAIL = [1, 2, 3, 4, 5, 6] as const;
const RECENTLY_ADDED_ITEMS_LIMIT = 30;

type RecentlyAddedMode = 'recent' | 'popular';

/** The item's rating on a 0–10 scale; 0 when the catalog has none. */
function catalogRating(item: RecentlyAddedItem): number {
    const rating = Number(item.rating);
    if (Number.isFinite(rating) && rating > 0) {
        return rating;
    }
    const fiveBased = Number(item.rating_5based);
    return Number.isFinite(fiveBased) && fiveBased > 0 ? fiveBased * 2 : 0;
}

@Component({
    selector: 'app-recently-added',
    templateUrl: './recently-added.component.html',
    styleUrls: ['./recently-added.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ContentCardComponent, ContentRailShellComponent, TranslatePipe],
})
export class RecentlyAddedComponent {
    private readonly xtreamStore = inject(XtreamStore);
    private readonly router = inject(Router);
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly translate = inject(TranslateService);
    // Re-compute translated labels when the active language changes.
    private readonly languageTick = injectTranslationTick();

    /**
     * `popular` (the "New & Popular" page) ranks the catalog by its rating
     * instead of its date; channels carry no rating and are left out.
     */
    readonly mode: RecentlyAddedMode =
        this.activatedRoute.snapshot.data['mode'] === 'popular'
            ? 'popular'
            : 'recent';
    readonly titleKey =
        this.mode === 'popular'
            ? 'WORKSPACE.DASHBOARD.NEW_AND_POPULAR'
            : 'PORTALS.SIDEBAR.RECENTLY_ADDED';

    /** TiagoTV: the Spanish and English catalog only, as the grids. */
    private readonly displayedContent = (type: ContentType) =>
        this.xtreamStore.getDisplayedContentByType()(
            type
        ) as RecentlyAddedItem[];

    readonly recentlyAddedLive = computed(() =>
        this.mode === 'popular'
            ? []
            : this.getRecentlyAdded(this.displayedContent('live'))
    );
    readonly recentlyAddedVod = computed(() =>
        this.rank(this.displayedContent('vod'))
    );
    readonly recentlyAddedSeries = computed(() =>
        this.rank(this.displayedContent('series'), true)
    );

    readonly skeletonSlots = SKELETON_CARDS_PER_RAIL;

    readonly totalItems = computed(
        () =>
            this.recentlyAddedVod().length +
            this.recentlyAddedSeries().length +
            this.recentlyAddedLive().length
    );

    /**
     * Show skeleton rails when the store is still fetching AND we have
     * nothing resolved yet. Once a single section has data we drop the
     * skeletons so partial-load states aren't obscured.
     */
    readonly isLoading = computed(() => {
        const store = this.xtreamStore;
        const hasAnyData = this.totalItems() > 0;
        if (hasAnyData) return false;
        return (
            store.isLoadingContent() ||
            store.isLoadingCategories() ||
            store.isImporting()
        );
    });

    // Absolute rail "browse all" routes reuse the active playlist id. The
    // store owns the current playlist, so navigation stays correct even if
    // the user switches playlists before the rails finish loading.
    private readonly playlistId = computed(
        () => this.xtreamStore.currentPlaylist()?.id ?? null
    );

    readonly vodSeeAllLink = computed(() => this.buildSectionLink('vod'));
    readonly seriesSeeAllLink = computed(() => this.buildSectionLink('series'));
    readonly liveSeeAllLink = computed(() => this.buildSectionLink('live'));

    readonly vodSeeAllLabel = computed(() =>
        this.translateWithTick('PORTALS.BROWSE_ALL_MOVIES')
    );
    readonly seriesSeeAllLabel = computed(() =>
        this.translateWithTick('PORTALS.BROWSE_ALL_SERIES')
    );
    readonly liveSeeAllLabel = computed(() =>
        this.translateWithTick('PORTALS.BROWSE_ALL_LIVE')
    );

    private buildSectionLink(
        section: 'vod' | 'series' | 'live'
    ): string[] | null {
        const id = this.playlistId();
        if (!id) return null;
        return ['/workspace', 'xtreams', id, section];
    }

    private translateWithTick(key: string): string {
        this.languageTick();
        return this.translate.instant(key);
    }

    private rank<T extends RecentlyAddedItem>(
        items: T[],
        isSeries = false
    ): T[] {
        return this.mode === 'popular'
            ? this.getPopular(items, isSeries)
            : this.getRecentlyAdded(items, isSeries);
    }

    /**
     * Best rated first, the newer title winning a tie. A catalog without
     * ratings falls back to its newest titles.
     */
    private getPopular<T extends RecentlyAddedItem>(
        items: T[],
        isSeries: boolean
    ): T[] {
        const nowMs = Date.now();
        const rated = items
            .map((item) => ({
                item,
                rating: catalogRating(item),
                sortTimestamp: this.getSortTimestamp(item, isSeries, nowMs),
            }))
            .filter(({ rating }) => rating > 0);
        if (rated.length === 0) {
            return this.getRecentlyAdded(items, isSeries);
        }
        return rated
            .sort(
                (a, b) =>
                    b.rating - a.rating || b.sortTimestamp - a.sortTimestamp
            )
            .slice(0, RECENTLY_ADDED_ITEMS_LIMIT)
            .map(({ item }) => item);
    }

    private getRecentlyAdded<T extends RecentlyAddedItem>(
        items: T[],
        isSeries = false
    ): T[] {
        const nowMs = Date.now();

        return items
            .map((item) => ({
                item,
                sortTimestamp: this.getSortTimestamp(item, isSeries, nowMs),
            }))
            .filter(({ sortTimestamp }) => sortTimestamp > 0)
            .sort((a, b) => {
                return b.sortTimestamp - a.sortTimestamp;
            })
            .slice(0, RECENTLY_ADDED_ITEMS_LIMIT)
            .map(({ item }) => item);
    }

    getDate(item: RecentlyAddedItem, isSeries = false): number {
        const nowMs = Date.now();
        return (
            toXtreamRecentlyAddedTimestamp(
                this.getPrimaryTimestamp(item, isSeries),
                nowMs
            ) ||
            toXtreamRecentlyAddedTimestamp(
                this.getFallbackTimestamp(item, isSeries),
                nowMs
            )
        );
    }

    private getSortTimestamp(
        item: RecentlyAddedItem,
        isSeries: boolean,
        nowMs: number
    ): number {
        return (
            toXtreamRecentlyAddedTimestamp(
                this.getPrimaryTimestamp(item, isSeries),
                nowMs
            ) ||
            toXtreamRecentlyAddedTimestamp(
                this.getFallbackTimestamp(item, isSeries),
                nowMs
            )
        );
    }

    private getPrimaryTimestamp(
        item: RecentlyAddedItem,
        isSeries: boolean
    ): string | undefined {
        return isSeries ? item.last_modified : item.added;
    }

    private getFallbackTimestamp(
        item: RecentlyAddedItem,
        isSeries: boolean
    ): string | undefined {
        return isSeries ? item.added : item.last_modified;
    }

    openItem(item: RecentlyAddedItem, type: ContentType) {
        this.xtreamStore.setSelectedContentType(type);

        if (type === 'live') {
            const itemId = this.getItemId(item, type);
            this.router.navigate(['..', type, item.category_id], {
                relativeTo: this.activatedRoute,
                ...(itemId
                    ? {
                          state: {
                              openXtreamLiveItemId: Number(itemId),
                              openXtreamLiveTitle:
                                  item.title || item.name || '',
                              openXtreamLivePoster:
                                  item.poster_url || item.stream_icon || '',
                          },
                      }
                    : {}),
            });
        } else {
            const itemId = this.getItemId(item, type);
            this.router.navigate(['..', type, item.category_id, itemId], {
                relativeTo: this.activatedRoute,
            });
        }
    }

    private getItemId(
        item: RecentlyAddedItem,
        type: ContentType
    ): number | undefined {
        return (
            item.xtream_id ||
            item.id ||
            (type === 'series' ? item.series_id : item.stream_id)
        );
    }
}
