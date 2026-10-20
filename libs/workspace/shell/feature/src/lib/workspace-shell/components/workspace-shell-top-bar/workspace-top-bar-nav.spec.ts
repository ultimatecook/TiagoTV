import {
    readWorkspaceTopBarPage,
    resolveWorkspaceTopBarTab,
    WORKSPACE_TOP_BAR_TABS,
    WorkspaceTopBarTabId,
} from './workspace-top-bar-nav';

const tabAfter = (
    url: string,
    previous: WorkspaceTopBarTabId | null = null
): WorkspaceTopBarTabId | null =>
    resolveWorkspaceTopBarTab(readWorkspaceTopBarPage(url), previous);

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
        expect(tabAfter('/workspace/sports/laliga', 'home')).toBe('sports');
        expect(readWorkspaceTopBarPage('/workspace/sports').isLeague).toBe(
            false
        );
    });

    it('files a streaming platform under Inicio', () => {
        expect(tabAfter('/workspace/platforms/netflix', 'movies')).toBe(
            'home'
        );
        expect(
            readWorkspaceTopBarPage('/workspace/platforms/netflix').isTabRoot
        ).toBe(false);
    });

    it('keeps the tab a title was opened from', () => {
        const title = '/workspace/xtreams/p1/vod/12/345';
        expect(tabAfter(title, 'series')).toBe('series');
        expect(tabAfter(title, 'home')).toBe('home');
        // Opened straight (a reload): its section decides.
        expect(tabAfter(title)).toBe('movies');
        expect(tabAfter('/workspace/xtreams/p1/series/1/2')).toBe('series');
        expect(tabAfter('/workspace/xtreams/p1/live')).toBe('live');
        expect(tabAfter('/workspace/stalker/p1/itv')).toBe('live');
        expect(tabAfter('/workspace/xtreams/p1/favorites')).toBe('my-list');
        expect(tabAfter('/workspace/xtreams/p1/popular')).toBeNull();
    });

    it('keeps Inicio on a title the Home hero continues in recent', () => {
        // "Continuar" opens the title over /workspace/global-recent.
        expect(tabAfter('/workspace/global-recent', 'home')).toBe('home');
        expect(tabAfter('/workspace/global-recent', 'series')).toBe('series');
        // Opened straight (a reload, a deep link): Mi lista.
        expect(tabAfter('/workspace/global-recent')).toBe('my-list');
    });

    it('lights Buscar and Ajustes instead of a tab', () => {
        const search = readWorkspaceTopBarPage('/workspace/search?q=madrid');
        expect(search.utility).toBe('search');
        expect(search.isTabRoot).toBe(true);
        expect(tabAfter('/workspace/search', 'home')).toBeNull();

        const settings = readWorkspaceTopBarPage('/workspace/settings/epg');
        expect(settings.utility).toBe('settings');
        expect(tabAfter('/workspace/settings/epg', 'sports')).toBeNull();
        expect(
            readWorkspaceTopBarPage('/workspace/xtreams/p1/search').utility
        ).toBe('search');
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
