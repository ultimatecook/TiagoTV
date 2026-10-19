import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    untracked,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { normalizeDashboardRailsSettings } from '@iptvnator/shared/interfaces';
import { EmptyStateComponent } from '@iptvnator/playlist/shared/ui';
import {
    WORKSPACE_SHELL_ACTIONS,
    WorkspacePlaylistType,
} from '@iptvnator/workspace/shell/util';
import { RuntimeCapabilitiesService, SettingsStore } from '@iptvnator/services';
import { DashboardDataService } from '@iptvnator/workspace/dashboard/data-access';
import { PlatformsRailComponent } from '../platforms/ui/platforms-rail.component';
import { SportsRailComponent } from '../sports/ui/sports-rail.component';
import { DashboardHeroComponent } from './dashboard-hero.component';
import { DashboardHeroSlidesPresenter } from './dashboard-hero-slides.presenter';
import { DashboardLiveEpgClock } from './dashboard-live-epg-clock';
import { DashboardLiveEpgPresenter } from './dashboard-live-epg.presenter';
import { buildPlaybackPositionReloadKey } from './dashboard-playback.utils';
import { DashboardPortalLiveEpgPresenter } from './dashboard-portal-live-epg.presenter';
import { RAIL_ITEM_LIMIT } from './dashboard-rail.utils';
import { HomeEventsComponent } from './home-events.component';
import { HomeRecentChannelsComponent } from './home-recent-channels.component';
import { HomeSeriesComponent } from './home-series.component';
import { HomeTopMoviesComponent } from './home-top-movies.component';

/**
 * TiagoTV's Home (README "01 · Inicio"), top to bottom: the "Seguir
 * viendo" hero slider behind the top bar, the streaming platforms, the
 * sports cards, today's events, the platforms' Top 10 movies, series
 * picked for the user and the live channels watched last. Each section
 * renders as soon as its own data is ready and is left out while it has
 * none; the ones below the fold load when they come near.
 *
 * The Settings → Panel switches still apply: the hero ("Banner
 * principal") and the recently watched channels ("TV en directo vista
 * recientemente").
 */
@Component({
    selector: 'lib-workspace-dashboard-rails',
    imports: [
        DashboardHeroComponent,
        EmptyStateComponent,
        HomeEventsComponent,
        HomeRecentChannelsComponent,
        HomeSeriesComponent,
        HomeTopMoviesComponent,
        PlatformsRailComponent,
        SportsRailComponent,
        TranslatePipe,
    ],
    templateUrl: './workspace-dashboard-rails.component.html',
    styleUrl: './workspace-dashboard-rails.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.rails-page-host--empty]': 'ready() && !hasPlaylists()',
    },
    providers: [
        DashboardLiveEpgClock,
        DashboardLiveEpgPresenter,
        DashboardPortalLiveEpgPresenter,
        // Page-level so the page knows whether the hero has anything to
        // show (it bleeds up behind the top bar only when it does).
        DashboardHeroSlidesPresenter,
    ],
})
export class WorkspaceDashboardRailsComponent {
    readonly data = inject(DashboardDataService);
    readonly heroSlides = inject(DashboardHeroSlidesPresenter);
    private readonly shellActions = inject(WORKSPACE_SHELL_ACTIONS);
    private readonly settingsStore = inject(SettingsStore);

    readonly isElectron = inject(RuntimeCapabilitiesService).isElectron;
    readonly hasPlaylists = computed(() => this.data.playlists().length > 0);
    readonly ready = this.data.dashboardReady;
    readonly dashboardRails = computed(() =>
        normalizeDashboardRailsSettings(this.settingsStore.dashboardRails?.())
    );
    readonly showHero = computed(
        () =>
            this.dashboardRails().hero &&
            (this.heroSlides.slides().length > 0 || this.heroSlides.loading())
    );

    private readonly playbackPositionReloadKey = computed(() =>
        buildPlaybackPositionReloadKey(this.data.globalRecentVodItems())
    );

    constructor() {
        // Re-entering the Home picks up the history and favourites changed
        // while away (newly backfilled backdrops included).
        void this.data.reloadGlobalRecentItems();
        void this.data.reloadGlobalFavorites();

        // The hero's discovery slides: the newest imports, once the
        // favourites have had the DB worker first (and again when a
        // provider is added).
        effect(() => {
            if (
                this.data.xtreamPlaylistCount() === 0 ||
                !this.data.globalFavoritesLoaded()
            ) {
                return;
            }
            void this.data.reloadXtreamRecentlyAddedItems(RAIL_ITEM_LIMIT);
        });

        // Playback positions follow the VOD/series history, so the hero
        // knows what is unfinished and how much is left. The primitive key
        // keeps live-only history churn out of the IPC path.
        effect(() => {
            this.playbackPositionReloadKey();
            untracked(() => void this.data.reloadPlaybackPositions());
        });
    }

    onAddPlaylist(type?: WorkspacePlaylistType): void {
        this.shellActions.openAddPlaylistDialog(type);
    }
}
