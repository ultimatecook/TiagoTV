import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Route, Router } from '@angular/router';
import { ParentalLockService, SettingsStore } from '@iptvnator/services';

@Component({ template: '' })
class RoutePageStubComponent {}

type AppRoutesModule = typeof import('./app.routes');

describe('app routes', () => {
    let workspaceRoute: import('@angular/router').Route | undefined;
    let workspaceChildren: Array<{
        canActivate?: unknown[];
        data?: Record<string, unknown>;
        loadChildren?: unknown;
        loadComponent?: unknown;
        path?: string;
        redirectTo?: unknown;
    }> = [];
    let resolveRecordingsCapabilityRoute: AppRoutesModule['resolveRecordingsCapabilityRoute'];
    let appRoutesList: Route[] = [];

    beforeAll(async () => {
        // The league guard reads the competitions the hub lists.
        jest.unstable_mockModule('@iptvnator/workspace/dashboard/feature', () => ({
            SPORT_SECTIONS: [{ id: 'laliga' }, { id: 'premier-league' }],
        }));
        jest.unstable_mockModule(
            '@iptvnator/playlist/m3u/feature-player',
            () => ({
                createM3uWorkspaceRoutes: () => [
                    {
                        path: '',
                        pathMatch: 'full',
                        redirectTo: 'all',
                    },
                    {
                        path: 'favorites',
                        data: {
                            mode: 'favorites',
                            portalType: 'm3u',
                            defaultScope: 'playlist',
                        },
                    },
                    {
                        path: 'recent',
                        data: {
                            mode: 'recent',
                            portalType: 'm3u',
                            defaultScope: 'playlist',
                        },
                    },
                    {
                        path: ':view',
                    },
                ],
            })
        );

        const appRoutes = await import('./app.routes');
        const { routes } = appRoutes;
        appRoutesList = routes;
        workspaceRoute = routes.find((route) => route.path === 'workspace');
        workspaceChildren = workspaceRoute?.children ?? [];
        resolveRecordingsCapabilityRoute =
            appRoutes.resolveRecordingsCapabilityRoute;
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('waits for the parental lock state before activating workspace children', async () => {
        let releaseLock!: () => void;
        const lockPending = new Promise<void>((resolve) => {
            releaseLock = resolve;
        });
        const initialize = jest.fn(() => lockPending);
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: SettingsStore,
                    useValue: {
                        loadSettings: jest.fn().mockResolvedValue(undefined),
                    },
                },
                { provide: ParentalLockService, useValue: { initialize } },
            ],
        });
        const settingsReadyResolver =
            workspaceRoute?.resolve?.['settingsReady'];
        if (typeof settingsReadyResolver !== 'function') {
            throw new Error('resolver missing');
        }
        let resolved = false;
        const resolution = TestBed.runInInjectionContext(() =>
            Promise.resolve(
                (
                    settingsReadyResolver as import('@angular/router').ResolveFn<void>
                )(
                    {} as import('@angular/router').ActivatedRouteSnapshot,
                    {} as import('@angular/router').RouterStateSnapshot
                )
            )
        ).then(() => {
            resolved = true;
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(initialize).toHaveBeenCalled();
        expect(resolved).toBe(false);

        releaseLock();
        await resolution;
        expect(resolved).toBe(true);
    });

    it('waits for settings before activating workspace children', async () => {
        let releaseSettings!: () => void;
        const settingsPending = new Promise<void>((resolve) => {
            releaseSettings = resolve;
        });
        const loadSettings = jest.fn(() => settingsPending);
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: SettingsStore,
                    useValue: { loadSettings },
                },
                {
                    provide: ParentalLockService,
                    useValue: {
                        initialize: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        });
        const settingsReadyResolver =
            workspaceRoute?.resolve?.['settingsReady'];

        expect(typeof settingsReadyResolver).toBe('function');
        if (typeof settingsReadyResolver !== 'function') {
            return;
        }

        const resolution = TestBed.runInInjectionContext(() =>
            Promise.resolve(
                (
                    settingsReadyResolver as import('@angular/router').ResolveFn<void>
                )(
                    {} as import('@angular/router').ActivatedRouteSnapshot,
                    {} as import('@angular/router').RouterStateSnapshot
                )
            )
        );
        let resolved = false;
        void resolution.then(() => {
            resolved = true;
        });

        await Promise.resolve();

        expect(loadSettings).toHaveBeenCalledTimes(1);
        expect(resolved).toBe(false);

        releaseSettings();

        await expect(resolution).resolves.toBeUndefined();
        expect(resolved).toBe(true);
    });

    it('lazy-loads M3U workspace routes through the feature boundary', async () => {
        const playlistRoute = workspaceChildren.find(
            (route) => route.path === 'playlists/:id'
        );
        const loadChildren = playlistRoute?.loadChildren as
            (() => Promise<typeof workspaceChildren>) | undefined;
        const m3uRoutes = (await loadChildren?.()) ?? [];
        const defaultRoute = m3uRoutes.find((route) => route.path === '');
        const favoritesRoute = m3uRoutes.find(
            (route) => route.path === 'favorites'
        );
        const recentRoute = m3uRoutes.find((route) => route.path === 'recent');
        const playerRoute = m3uRoutes.find((route) => route.path === ':view');

        expect(defaultRoute?.redirectTo).toBe('all');
        expect(favoritesRoute?.data).toEqual({
            mode: 'favorites',
            portalType: 'm3u',
            defaultScope: 'playlist',
        });
        expect(recentRoute?.data).toEqual({
            mode: 'recent',
            portalType: 'm3u',
            defaultScope: 'playlist',
        });

        expect(playerRoute).toBeDefined();
    });

    it('adds a shared /workspace/global-recent route', async () => {
        const globalRecentRoute = workspaceChildren.find(
            (route) => route.path === 'global-recent'
        );

        expect(globalRecentRoute?.data).toEqual({
            mode: 'recent',
            defaultScope: 'all',
        });
        expect(typeof globalRecentRoute?.loadComponent).toBe('function');
    });

    it('adds a routed /workspace/search page in every runtime', async () => {
        const globalSearchRoute = workspaceChildren.find(
            (route) => route.path === 'search'
        );

        // The search page reads the stored catalogs, so the browser build
        // opens it too.
        expect(globalSearchRoute?.canActivate).toBeUndefined();
        expect(typeof globalSearchRoute?.loadComponent).toBe('function');
    });

    it('guards the focused recording detail behind the recordings capability', async () => {
        const recordingRoute = workspaceChildren.find(
            (route) => route.path === 'downloads/recording/:recordingId'
        );

        expect(recordingRoute?.canActivate).toHaveLength(1);
    });

    it('redirects the recording detail to the manager without the capability', async () => {
        const redirectTree = { url: '/workspace/downloads' };
        const parseUrl = jest.fn().mockReturnValue(redirectTree);

        const result = resolveRecordingsCapabilityRoute(
            { supportsRecordings: false },
            { parseUrl }
        );

        expect(parseUrl).toHaveBeenCalledWith('/workspace/downloads');
        expect(result).toBe(redirectTree);
        expect(
            resolveRecordingsCapabilityRoute(
                { supportsRecordings: true },
                { parseUrl }
            )
        ).toBe(true);
    });

    it('uses a dynamic redirect for the default /workspace child route', async () => {
        const workspaceDefaultRoute = workspaceChildren.find(
            (route) => route.path === ''
        );

        expect(typeof workspaceDefaultRoute?.redirectTo).toBe('function');
    });

    /**
     * The real redirects in a router with stub pages: the workspace entry
     * lands on Inicio, as `workspaceEntryRedirect` does by default.
     */
    async function routerWithAppRedirects(): Promise<Router> {
        const leagueRoutes = workspaceChildren
            .filter((route) => route.path === 'sports/:sectionId')
            .map((route) => {
                const { loadComponent: _lazy, ...rest } = route as Route;
                return rest.redirectTo
                    ? rest
                    : { ...rest, component: RoutePageStubComponent };
            });
        const page = (path: string): Route => ({
            path,
            component: RoutePageStubComponent,
        });
        TestBed.configureTestingModule({
            providers: [
                provideLocationMocks(),
                provideRouter([
                    ...appRoutesList.filter(
                        (route) => route.path === '' && route.redirectTo
                    ),
                    {
                        path: 'workspace',
                        children: [
                            {
                                path: '',
                                pathMatch: 'full',
                                redirectTo: 'dashboard',
                            },
                            page('dashboard'),
                            { ...page('sports'), pathMatch: 'full' },
                            ...leagueRoutes,
                            page('settings/:section'),
                        ],
                    },
                    ...appRoutesList.filter((route) => route.path === '**'),
                ]),
            ],
        });
        const router = TestBed.inject(Router);
        router.initialNavigation();
        return router;
    }

    it('sends an unknown address to the workspace entry, Inicio', async () => {
        const router = await routerWithAppRedirects();

        await router.navigateByUrl('/workspace/nope');
        expect(router.url).toBe('/workspace/dashboard');

        await router.navigateByUrl('/nope/deeper');
        expect(router.url).toBe('/workspace/dashboard');
    });

    it('opens the hub for a competition the app does not follow', async () => {
        const router = await routerWithAppRedirects();

        await router.navigateByUrl('/workspace/sports/laliga');
        expect(router.url).toBe('/workspace/sports/laliga');

        await router.navigateByUrl('/workspace/sports/nope');
        expect(router.url).toBe('/workspace/sports');
    });

    it('protects the dashboard route behind a visibility guard', async () => {
        const dashboardRoute = workspaceChildren.find(
            (route) => route.path === 'dashboard'
        );

        expect(dashboardRoute?.canActivate).toHaveLength(1);
    });
});
