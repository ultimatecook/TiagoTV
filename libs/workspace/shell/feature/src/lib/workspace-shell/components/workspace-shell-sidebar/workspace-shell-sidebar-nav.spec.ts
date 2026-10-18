import { buildWorkspaceSidebarGroups } from './workspace-shell-sidebar-nav';

function linksById(
    groups: ReturnType<typeof buildWorkspaceSidebarGroups>
): Record<string, string> {
    return Object.fromEntries(
        groups.flatMap((group) =>
            group.items.map((item) => [item.id, item.link.join('/')])
        )
    );
}

describe('buildWorkspaceSidebarGroups', () => {
    it('lists the Home and Library entries of the design, in order', () => {
        const groups = buildWorkspaceSidebarGroups(null);

        expect(groups.map((group) => group.id)).toEqual(['home', 'library']);
        expect(groups[0].items.map((item) => item.id)).toEqual([
            'home',
            'new-popular',
            'tv-shows',
            'movies',
            'my-list',
            'languages',
        ]);
        expect(groups[1].items.map((item) => item.id)).toEqual([
            'recently-added',
            'watch-later',
            'downloads',
            'account',
        ]);
    });

    it('browses the active Xtream source', () => {
        const links = linksById(
            buildWorkspaceSidebarGroups({
                provider: 'xtreams',
                playlistId: 'p1',
            })
        );

        expect(links).toMatchObject({
            home: '/workspace/dashboard',
            'new-popular': '/workspace/xtreams/p1/popular',
            'tv-shows': '/workspace/xtreams/p1/series',
            movies: '/workspace/xtreams/p1/vod',
            'my-list': '/workspace/global-favorites',
            languages: '/workspace/xtreams/p1/live',
            'recently-added': '/workspace/xtreams/p1/recently-added',
            'watch-later': '/workspace/global-recent',
            downloads: '/workspace/downloads',
            account: '/workspace/sources',
        });
    });

    it('opens the Stalker live TV and M3U groups for "Browse by Languages"', () => {
        expect(
            linksById(
                buildWorkspaceSidebarGroups({
                    provider: 'stalker',
                    playlistId: 's1',
                })
            ).languages
        ).toBe('/workspace/stalker/s1/itv');
        expect(
            linksById(
                buildWorkspaceSidebarGroups({
                    provider: 'playlists',
                    playlistId: 'm1',
                })
            ).languages
        ).toBe('/workspace/playlists/m1/groups');
    });

    it('sends catalog entries to the sources page without an active source', () => {
        const links = linksById(buildWorkspaceSidebarGroups(null));

        expect(links.movies).toBe('/workspace/sources');
        expect(links['tv-shows']).toBe('/workspace/sources');
        expect(links['recently-added']).toBe('/workspace/global-recent');
    });

    it('marks only Home as an exact match', () => {
        const exact = buildWorkspaceSidebarGroups(null)
            .flatMap((group) => group.items)
            .filter((item) => item.exact)
            .map((item) => item.id);

        expect(exact).toEqual(['home']);
    });
});
