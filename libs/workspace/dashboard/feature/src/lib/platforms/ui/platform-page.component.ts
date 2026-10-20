import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    linkedSignal,
} from '@angular/core';
import {
    ActivatedRoute,
    NavigationEnd,
    NavigationStart,
    Router,
} from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
    registerWorkspaceBack,
    WorkspaceBackNavigationService,
} from '@iptvnator/portal/shared/data-access';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import { buildBrandRows } from '../platform-brands';
import { platformDesign, tileDress } from '../platform-design';
import { pickRecommendations } from '../platform-hero';
import { buildPlatformRows } from '../platform-rows';
import { daySeed } from '../platform-seed';
import { PlatformThemeService } from '../platform-theme.service';
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
/** Titles the hero shows in turn. */
const HERO_COUNT = 6;
/** A view restored by Back or Forward may still be filling in: retry this long. */
const SCROLL_RESTORE_MS = 800;

/**
 * A platform's page (/workspace/platforms/:platformId), laid out like the
 * platform's own app (`platformDesign`): Netflix's billboard, 16:9 tiles
 * and Top 10, Prime Video's carousel, HBO Max's posters, Apple TV's large
 * cards, Disney+'s carousel and brand tiles… Then what is new, its movies,
 * its series and its genres, one row each; a row's title opens all of it.
 * The hero's picks and the rows' mix are the day's (`daySeed`), taken once
 * so they hold still while the page is open.
 *
 * A row shown whole is a history entry of its own (`?row=`): Back closes
 * it, a title opened from it comes back to it, and Back or Forward between
 * the rows and the whole row returns each to where it was scrolled.
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
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly backNavigation = inject(WorkspaceBackNavigationService);

    /** Bound from the route parameter. */
    readonly platformId = input<string>('');
    /** Bound from `?row=`: the row shown whole. */
    readonly row = input<string | undefined>(undefined);
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
    private readonly seed = daySeed();
    /** The titles the hero recommends, which the rows beside it leave out. */
    readonly hero = computed(() =>
        pickRecommendations(this.titles() ?? [], HERO_COUNT, this.seed)
    );
    readonly rows = computed(() => {
        const titles = this.titles();
        const platform = this.platform();
        return titles && platform
            ? buildPlatformRows(titles, {
                  top10Of: this.design()?.top10 ? platform.name : undefined,
                  hero: this.hero(),
                  seed: this.seed,
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
    readonly openRowId = computed(() => this.row() || null);
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
    readonly gridDress = computed(() => {
        const design = this.design();
        return design ? tileDress(design, this.openRowId() ?? '', true) : null;
    });
    /** Everything the open row holds, more than its strip shows. */
    readonly openTitles = computed(() => {
        const row = this.openRow();
        return row ? (row.all ?? row.titles) : [];
    });
    readonly visible = computed(() => this.openTitles().slice(0, this.shown()));
    readonly hasMore = computed(() => this.openTitles().length > this.shown());

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
        // The header's Back (and the mouse's, and Cmd+[) closes the row.
        registerWorkspaceBack({
            available: () => this.openRowId() !== null,
            run: () => this.backToRows(),
        });
        this.followViewScroll();
    }

    openAll(rowId: string): void {
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { row: rowId },
        });
    }

    /** History Back to the rows; the rows in place when the row opened the session. */
    backToRows(): void {
        this.backNavigation.back(() => [
            '/workspace',
            'platforms',
            this.platformId(),
        ]);
    }

    showMore(): void {
        this.shown.update((count) => count + PAGE);
    }

    /**
     * The shell restores the scroll of a page come back to, not of a query
     * change on the same page: Back or Forward between the rows and a row
     * shown whole (the page stays) returns each view to where it was left.
     */
    private followViewScroll(): void {
        const host: HTMLElement = inject(ElementRef).nativeElement;
        const positions = new Map<number, number>();
        let currentId = -1;
        let restoreId: number | null = null;
        let cancelRestore: (() => void) | null = null;
        const subscription = this.router.events.subscribe((event) => {
            const scroller = host.closest('main');
            if (event instanceof NavigationStart) {
                if (scroller) positions.set(currentId, scroller.scrollTop);
                restoreId = event.restoredState?.navigationId ?? null;
            } else if (event instanceof NavigationEnd) {
                currentId = event.id;
                const top =
                    restoreId === null ? undefined : positions.get(restoreId);
                if (scroller && top !== undefined) {
                    cancelRestore?.();
                    cancelRestore = restoreScrollTop(scroller, top);
                }
            }
        });
        inject(DestroyRef).onDestroy(() => {
            subscription.unsubscribe();
            cancelRestore?.();
        });
    }
}

/** Scrolls back to `top` once the view is tall enough; the user's wheel wins. */
function restoreScrollTop(element: HTMLElement, top: number): () => void {
    const view = element.ownerDocument.defaultView;
    if (!view) return () => undefined;
    const started = view.performance.now();
    let frame = 0;
    const attempt = () => {
        element.scrollTop = top;
        if (
            Math.abs(element.scrollTop - top) >= 2 &&
            view.performance.now() - started < SCROLL_RESTORE_MS
        ) {
            frame = view.requestAnimationFrame(attempt);
        }
    };
    // After the view the navigation brought has rendered.
    frame = view.requestAnimationFrame(attempt);
    const stop = () => view.cancelAnimationFrame(frame);
    element.addEventListener('wheel', stop, { once: true, passive: true });
    return () => {
        stop();
        element.removeEventListener('wheel', stop);
    };
}
