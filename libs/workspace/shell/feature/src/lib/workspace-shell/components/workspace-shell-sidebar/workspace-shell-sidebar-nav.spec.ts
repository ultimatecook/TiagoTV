import {
    buildWorkspaceSidebarNav,
    SIDEBAR_SETTINGS_PATH,
    WorkspaceSidebarItem,
} from './workspace-shell-sidebar-nav';

function allItems(
    nav: ReturnType<typeof buildWorkspaceSidebarNav>
): WorkspaceSidebarItem[] {
    return [...nav.main, nav.allChannels, ...nav.saved, nav.settings];
}

function linksById(
    nav: ReturnType<typeof buildWorkspaceSidebarNav>
): Record<string, string> {
    const links: Record<string, string> = {};
    for (const item of allItems(nav)) {
        links[item.id] = item.link.join('/');
    }
    return links;
}

describe('buildWorkspaceSidebarNav', () => {
    it('lists the main links, the live channels link and Guardados, in order', () => {
        const nav = buildWorkspaceSidebarNav(null);

        expect(nav.main.map((item) => item.id)).toEqual([
            'home',
            'movies',
            'tv-shows',
            'new-popular',
            'countries',
        ]);
        expect(nav.allChannels.id).toBe('all-channels');
        expect(nav.saved.map((item) => item.id)).toEqual([
            'my-list',
            'watch-later',
            'recently-added',
            'downloads',
        ]);
        expect(nav.settings.id).toBe('settings');
    });

    it('browses the active Xtream source', () => {
        const links = linksById(
            buildWorkspaceSidebarNav({
                provider: 'xtreams',
                playlistId: 'p1',
            })
        );

        expect(links).toMatchObject({
            home: '/workspace/dashboard',
            movies: '/workspace/xtreams/p1/vod',
            'tv-shows': '/workspace/xtreams/p1/series',
            'new-popular': '/workspace/xtreams/p1/popular',
            countries: '/workspace/countries',
            'all-channels': '/workspace/xtreams/p1/live',
            'my-list': '/workspace/global-favorites',
            'watch-later': '/workspace/global-recent',
            'recently-added': '/workspace/xtreams/p1/recently-added',
            downloads: '/workspace/downloads',
        });
    });

    it('opens the Stalker live TV and the M3U channel list for "All channels"', () => {
        expect(
            buildWorkspaceSidebarNav({
                provider: 'stalker',
                playlistId: 's1',
            }).allChannels.link.join('/')
        ).toBe('/workspace/stalker/s1/itv');
        expect(
            buildWorkspaceSidebarNav({
                provider: 'playlists',
                playlistId: 'm1',
            }).allChannels.link.join('/')
        ).toBe('/workspace/playlists/m1/all');
    });

    it('sends catalog entries to the sources page without an active source', () => {
        const links = linksById(buildWorkspaceSidebarNav(null));

        expect(links.movies).toBe('/workspace/sources');
        expect(links['tv-shows']).toBe('/workspace/sources');
        expect(links['all-channels']).toBe('/workspace/sources');
        expect(links['recently-added']).toBe('/workspace/global-recent');
    });

    it('opens Settings on its sources section, as "My Account" did', () => {
        const { settings } = buildWorkspaceSidebarNav(null);

        expect(settings.link).toEqual(SIDEBAR_SETTINGS_PATH);
        expect(settings.link.join('/')).toBe('/workspace/settings/sources');
        // Lit on every settings page by the shell, not by this one link.
        expect(settings.highlights).toBe(false);
    });

    it('lights up only the entry that owns a shared page', () => {
        const highlighting = (
            nav: ReturnType<typeof buildWorkspaceSidebarNav>
        ) =>
            allItems(nav)
                .filter((item) => item.highlights)
                .map((item) => item.id);

        // Without a source, the catalog entries all open the sources page
        // and Recently Added opens Watch Later's.
        expect(highlighting(buildWorkspaceSidebarNav(null))).toEqual([
            'home',
            'countries',
            'my-list',
            'watch-later',
            'downloads',
        ]);
        expect(
            highlighting(
                buildWorkspaceSidebarNav({
                    provider: 'xtreams',
                    playlistId: 'p1',
                })
            )
        ).toHaveLength(10);
    });

    it('marks only Home as an exact match', () => {
        const exact = allItems(buildWorkspaceSidebarNav(null))
            .filter((item) => item.exact)
            .map((item) => item.id);

        expect(exact).toEqual(['home']);
    });
});
