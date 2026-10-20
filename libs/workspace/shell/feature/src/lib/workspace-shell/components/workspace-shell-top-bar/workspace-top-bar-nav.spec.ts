import {
    readWorkspaceTopBarPage,
    resolveWorkspaceTopBarTab,
    WORKSPACE_TOP_BAR_TABS,
    WorkspaceTopBarTabId,
} from './workspace-top-bar-nav';

/**
 * The tab `url` lights when opened from `from` (null: a reload or a deep
 * link), which lit `fromTab` (by default the tab it lights itself).
 */
const tabAfter = (
    url: string,
    from: string | null = null,
    fromTab?: WorkspaceTopBarTabId | null
): WorkspaceTopBarTabId | null => {
    const opener = from === null ? null : readWorkspaceTopBarPage(from);
    return resolveWorkspaceTopBarTab(
        readWorkspaceTopBarPage(url),
        opener && {
            page: opener,
            tab:
                fromTab === undefined
                    ? resolveWorkspaceTopBarTab(opener, null)
                    : fromTab,
        }
    );
};

describe('workspace top bar navigation', () => {
    it('lists the six tabs in the capsule order with their routes', () => {
        expect(
            WORKSPACE_TOP_BAR_TABS.map((tab) => tab.link.join('/'))
        ).toEqual([
            '/workspace/dashboard',
            '/workspace/sports',
            '/workspace/series',
            '/workspace/movies',
            '/workspace/countries',
            '/workspace/global-favorites',
        ]);
    });

    it('lights each tab on its own page, query and fragment aside', () => {
        expect(tabAfter('/workspace/dashboard')).toBe('home');
        expect(tabAfter('/workspace/sports?day=today')).toBe('sports');
        expect(tabAfter('/workspace/series')).toBe('series');
        expect(tabAfter('/workspace/movies#top')).toBe('movies');
        expect(tabAfter('/workspace/countries')).toBe('live');
        expect(tabAfter('/workspace/countries/es')).toBe('live');
        expect(tabAfter('/workspace/global-favorites')).toBe('my-list');
    });

    it('keeps Deportes on a league page, which goes back to the hub', () => {
        const league = readWorkspaceTopBarPage('/workspace/sports/laliga');
        expect(league.isLeague).toBe(true);
        expect(league.isTabRoot).toBe(false);
        expect(tabAfter('/workspace/sports/laliga', '/workspace/dashboard')).toBe(
            'sports'
        );
        expect(readWorkspaceTopBarPage('/workspace/sports').isLeague).toBe(
            false
        );
    });

    it('files a streaming platform under Inicio', () => {
        expect(tabAfter('/workspace/platforms/netflix', '/workspace/movies')).toBe(
            'home'
        );
        expect(
            readWorkspaceTopBarPage('/workspace/platforms/netflix').isTabRoot
        ).toBe(false);
    });

    it('keeps the tab a title was opened from', () => {
        const title = '/workspace/xtreams/p1/vod/12/345';
        expect(tabAfter(title, '/workspace/series')).toBe('series');
        expect(tabAfter(title, '/workspace/dashboard')).toBe('home');
        expect(tabAfter(title, '/workspace/platforms/netflix')).toBe('home');
        // Opened straight (a reload): its section decides.
        expect(tabAfter(title)).toBe('movies');
        expect(tabAfter('/workspace/xtreams/p1/series/1/2')).toBe('series');
        expect(tabAfter('/workspace/xtreams/p1/popular')).toBeNull();
    });

    it('follows the section for a title opened from another deep page', () => {
        // A series title lit Inicio; the film it recommends is a Película.
        const series = '/workspace/xtreams/p1/series/1/2';
        const film = '/workspace/xtreams/p1/vod/12/345';
        expect(tabAfter(film, series, 'home')).toBe('movies');
        // A page without a section keeps the tab lit before.
        expect(tabAfter('/workspace/xtreams/p1/popular', series, 'home')).toBe(
            'home'
        );
    });

    it('lights a portal section\'s own tab whatever opened it', () => {
        // The mini-player's "Abrir" and Mi lista open the channel list.
        expect(
            tabAfter('/workspace/xtreams/p1/live', '/workspace/global-favorites')
        ).toBe('live');
        expect(
            tabAfter('/workspace/xtreams/p1/live/7', '/workspace/dashboard')
        ).toBe('live');
        expect(
            tabAfter('/workspace/xtreams/p1/vod', '/workspace/countries')
        ).toBe('movies');
        expect(tabAfter('/workspace/xtreams/p1/vod/12', '/workspace/sports')).toBe(
            'movies'
        );
        expect(
            tabAfter('/workspace/xtreams/p1/series', '/workspace/movies')
        ).toBe('series');
        expect(tabAfter('/workspace/stalker/p1/itv', '/workspace/series')).toBe(
            'live'
        );
        expect(tabAfter('/workspace/stalker/p1/vod/3')).toBe('movies');
        expect(
            tabAfter('/workspace/xtreams/p1/favorites', '/workspace/dashboard')
        ).toBe('my-list');
    });

    it('lights no tab on Fuentes and Descargas', () => {
        for (const url of [
            '/workspace/sources',
            '/workspace/downloads',
            '/workspace/downloads/d1',
            '/workspace/xtreams/p1/downloads',
        ]) {
            expect(tabAfter(url, '/workspace/global-favorites')).toBeNull();
            expect(tabAfter(url)).toBeNull();
        }
    });

    it('keeps Inicio on a title the Home hero continues in recent', () => {
        // "Continuar" opens the title over /workspace/global-recent.
        expect(tabAfter('/workspace/global-recent', '/workspace/dashboard')).toBe(
            'home'
        );
        expect(tabAfter('/workspace/global-recent', '/workspace/series')).toBe(
            'series'
        );
        // Opened straight (a reload, a deep link): Mi lista.
        expect(tabAfter('/workspace/global-recent')).toBe('my-list');
    });

    it('lights Buscar and Ajustes instead of a tab', () => {
        const search = readWorkspaceTopBarPage('/workspace/search?q=madrid');
        expect(search.utility).toBe('search');
        expect(search.isTabRoot).toBe(true);
        expect(tabAfter('/workspace/search', '/workspace/dashboard')).toBeNull();

        const settings = readWorkspaceTopBarPage('/workspace/settings/epg');
        expect(settings.utility).toBe('settings');
        expect(tabAfter('/workspace/settings/epg', '/workspace/sports')).toBeNull();
        expect(
            readWorkspaceTopBarPage('/workspace/xtreams/p1/search').utility
        ).toBe('search');
        expect(
            tabAfter('/workspace/xtreams/p1/search', '/workspace/movies')
        ).toBeNull();
    });

    it('scrolls the redesigned pages under the bar and frames the rest', () => {
        for (const url of [
            '/workspace/dashboard',
            '/workspace/sports/laliga',
            '/workspace/series',
            '/workspace/countries/ar',
            '/workspace/platforms/hbo',
            '/workspace/search',
            '/workspace/settings/general',
            '/workspace/global-favorites',
        ]) {
            expect(readWorkspaceTopBarPage(url).layout).toBe('scroll');
        }
        for (const url of [
            '/workspace/xtreams/p1/live',
            '/workspace/xtreams/p1/vod/1/2',
            '/workspace/playlists/p1/all',
            '/workspace/sources',
            '/workspace/downloads',
            '/elsewhere',
        ]) {
            expect(readWorkspaceTopBarPage(url).layout).toBe('framed');
        }
    });

    it('treats deep pages as such: Back stays available there', () => {
        expect(readWorkspaceTopBarPage('/workspace/dashboard').isTabRoot).toBe(
            true
        );
        expect(
            readWorkspaceTopBarPage('/workspace/xtreams/p1/vod/1/2').isTabRoot
        ).toBe(false);
        expect(readWorkspaceTopBarPage('/workspace/global-recent').isTabRoot).toBe(
            false
        );
        expect(readWorkspaceTopBarPage('/workspace/sources').isTabRoot).toBe(
            false
        );
    });
});
