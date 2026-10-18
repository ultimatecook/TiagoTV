import type { PortalProvider } from '@iptvnator/portal/shared/util';
import type { WorkspacePortalContext } from '@iptvnator/workspace/shell/util';
import type { WorkspaceSidebarIconName } from './workspace-shell-sidebar-icon.component';

export interface WorkspaceSidebarItem {
    readonly id: string;
    readonly labelKey: string;
    readonly icon: WorkspaceSidebarIconName;
    readonly link: readonly string[];
    /** Active only on the exact URL (Home), not on its descendants. */
    readonly exact: boolean;
    /**
     * Lights up on its page. A fallback link (a catalog entry with no source
     * yet) shares its page with the entry that owns it, so only the owner
     * lights up there.
     */
    readonly highlights: boolean;
}

export interface WorkspaceSidebarGroup {
    readonly id: 'home' | 'library';
    readonly labelKey: string;
    readonly items: readonly WorkspaceSidebarItem[];
}

type SourceSection = 'newPopular' | 'tvShows' | 'movies' | 'languages';

/**
 * Where each catalog entry of the sidebar lands for the active source. IPTV
 * providers group live channels by country/language, so "Browse by
 * Languages" opens the live categories. M3U playlists carry no movie/series
 * split: their entries fall back to the channel list and its groups.
 */
const SOURCE_SECTION_PATHS: Record<
    PortalProvider,
    Record<SourceSection, string>
> = {
    xtreams: {
        newPopular: 'popular',
        tvShows: 'series',
        movies: 'vod',
        languages: 'live',
    },
    stalker: {
        newPopular: 'vod',
        tvShows: 'series',
        movies: 'vod',
        languages: 'itv',
    },
    playlists: {
        newPopular: 'all',
        tvShows: 'groups',
        movies: 'all',
        languages: 'groups',
    },
};

const SOURCES_PATH = ['/workspace', 'sources'];
const GLOBAL_RECENT_PATH = ['/workspace', 'global-recent'];

/**
 * The TiagoTV sidebar: the "Home" group browses the active source's
 * catalog, the "Library" group holds what belongs to the viewer (history,
 * downloads, accounts). Without an active source every catalog entry opens
 * the sources page, where the first playlist is added.
 */
export function buildWorkspaceSidebarGroups(
    context: WorkspacePortalContext | null
): WorkspaceSidebarGroup[] {
    const sourceItem = (
        id: string,
        labelKey: string,
        icon: WorkspaceSidebarIconName,
        section: SourceSection
    ): WorkspaceSidebarItem =>
        context
            ? item(id, labelKey, icon, [
                  '/workspace',
                  context.provider,
                  context.playlistId,
                  SOURCE_SECTION_PATHS[context.provider][section],
              ])
            : item(id, labelKey, icon, SOURCES_PATH, { highlights: false });
    const recentlyAdded =
        context?.provider === 'xtreams'
            ? item('recently-added', 'RECENTLY_ADDED', 'clock', [
                  '/workspace',
                  'xtreams',
                  context.playlistId,
                  'recently-added',
              ])
            : item(
                  'recently-added',
                  'RECENTLY_ADDED',
                  'clock',
                  GLOBAL_RECENT_PATH,
                  {
                      highlights: false,
                  }
              );

    return [
        {
            id: 'home',
            labelKey: 'WORKSPACE.SIDEBAR.GROUP_HOME',
            items: [
                item('home', 'HOME', 'home', ['/workspace', 'dashboard'], {
                    exact: true,
                }),
                sourceItem('new-popular', 'NEW_POPULAR', 'flame', 'newPopular'),
                sourceItem('tv-shows', 'TV_SHOWS', 'tv', 'tvShows'),
                sourceItem('movies', 'MOVIES', 'film', 'movies'),
                item('my-list', 'MY_LIST', 'plus', [
                    '/workspace',
                    'global-favorites',
                ]),
                sourceItem('languages', 'LANGUAGES', 'globe', 'languages'),
            ],
        },
        {
            id: 'library',
            labelKey: 'WORKSPACE.SIDEBAR.GROUP_LIBRARY',
            items: [
                recentlyAdded,
                item(
                    'watch-later',
                    'WATCH_LATER',
                    'watch-later',
                    GLOBAL_RECENT_PATH
                ),
                item('downloads', 'DOWNLOADS', 'download', [
                    '/workspace',
                    'downloads',
                ]),
                item('account', 'MY_ACCOUNT', 'user', SOURCES_PATH),
            ],
        },
    ];
}

function item(
    id: string,
    labelKey: string,
    icon: WorkspaceSidebarIconName,
    link: string[],
    { exact = false, highlights = true } = {}
): WorkspaceSidebarItem {
    return {
        id,
        labelKey: `WORKSPACE.SIDEBAR.${labelKey}`,
        icon,
        link,
        exact,
        highlights,
    };
}
