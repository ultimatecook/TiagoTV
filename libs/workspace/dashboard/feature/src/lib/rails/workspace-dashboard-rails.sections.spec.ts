import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import {
    DEFAULT_DASHBOARD_RAILS_SETTINGS,
    type DashboardRailsSettings,
} from '@iptvnator/shared/interfaces';
import { RuntimeCapabilitiesService, SettingsStore } from '@iptvnator/services';
import { DashboardDataService } from '@iptvnator/workspace/dashboard/data-access';
import { WORKSPACE_SHELL_ACTIONS } from '@iptvnator/workspace/shell/util';
import { DashboardHeroSlidesPresenter } from './dashboard-hero-slides.presenter';
import { WorkspaceDashboardRailsComponent } from './workspace-dashboard-rails.component';

/** The Home's sections, as the page lists them. */
const SECTIONS = [
    'lib-dashboard-hero',
    'lib-platforms-rail',
    'lib-sports-rail',
    'lib-home-events',
    'lib-home-top-movies',
    'lib-home-series',
    'lib-home-recent-channels',
];

describe('WorkspaceDashboardRailsComponent sections', () => {
    const rails = signal<unknown>(undefined);

    function render() {
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                {
                    provide: DashboardDataService,
                    useValue: {
                        playlists: signal([{ _id: 'xtream' }]),
                        playlistsLoaded: signal(true),
                        dashboardReady: signal(true),
                        xtreamPlaylistCount: signal(0),
                        globalFavoritesLoaded: signal(false),
                        globalRecentVodItems: signal([]),
                        reloadGlobalRecentItems: jest.fn(),
                        reloadGlobalFavorites: jest.fn(),
                        reloadXtreamRecentlyAddedItems: jest.fn(),
                        reloadPlaybackPositions: jest.fn(),
                    },
                },
                { provide: SettingsStore, useValue: { dashboardRails: rails } },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { isElectron: false },
                },
                {
                    provide: WORKSPACE_SHELL_ACTIONS,
                    useValue: { openAddPlaylistDialog: jest.fn() },
                },
            ],
        });
        // The sections themselves are not under test: placeholders.
        TestBed.overrideComponent(WorkspaceDashboardRailsComponent, {
            set: {
                imports: [TranslatePipe],
                schemas: [CUSTOM_ELEMENTS_SCHEMA],
                providers: [
                    {
                        provide: DashboardHeroSlidesPresenter,
                        useValue: {
                            slides: signal([{ id: 'slide' }]),
                            loading: signal(false),
                        },
                    },
                ],
            },
        });
        const fixture = TestBed.createComponent(
            WorkspaceDashboardRailsComponent
        );
        fixture.detectChanges();
        const element = fixture.nativeElement as HTMLElement;
        return SECTIONS.filter((tag) => element.querySelector(tag) !== null);
    }

    it('shows every section by default', () => {
        rails.set(undefined);
        expect(render()).toEqual(SECTIONS);
    });

    it('leaves out each section switched off in Settings', () => {
        const off: Partial<DashboardRailsSettings> = {
            platforms: false,
            events: false,
            seriesForYou: false,
        };
        rails.set({ ...DEFAULT_DASHBOARD_RAILS_SETTINGS, ...off });
        expect(render()).toEqual([
            'lib-dashboard-hero',
            'lib-sports-rail',
            'lib-home-top-movies',
            'lib-home-recent-channels',
        ]);
    });

    it('hides the hero, the sports and the Top 10 on their own switches', () => {
        rails.set({
            ...DEFAULT_DASHBOARD_RAILS_SETTINGS,
            hero: false,
            sports: false,
            topMovies: false,
            recentlyWatchedLive: false,
        });
        expect(render()).toEqual([
            'lib-platforms-rail',
            'lib-home-events',
            'lib-home-series',
        ]);
    });

    it('shows the new sections over an older release’s stored rails', () => {
        // Stored before the redesign: no key for the new sections.
        rails.set({ hero: true, continueWatching: false, tmdbTrending: false });
        expect(render()).toEqual(SECTIONS);
    });
});
