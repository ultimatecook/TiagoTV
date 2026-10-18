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

/** The sidebar's fixed links; the brand rows come from the catalogs. */
export interface WorkspaceSidebarNav {
    /** Inicio, Películas, Series, Novedades y populares, Por países. */
    readonly main: readonly WorkspaceSidebarItem[];
    /** "Todos los canales", the last row of Canales en vivo. */
    readonly allChannels: WorkspaceSidebarItem;
    /** Mi lista, Ver más tarde, Agregados recientemente, Descargas. */
    readonly saved: readonly WorkspaceSidebarItem[];
    /** The unified settings page, opened on Fuentes y cuentas. */
    readonly settings: WorkspaceSidebarItem;
}

type SourceSection = 'newPopular' | 'tvShows' | 'movies' | 'live';

/**
 * Where each catalog entry of the sidebar lands for the active source.
 * M3U playlists carry no movie/series split: their entries fall back to the
 * channel list and its groups.
 */
const SOURCE_SECTION_PATHS: Record<
    PortalProvider,
    Record<SourceSection, string>
> = {
    xtreams: {
        newPopular: 'popular',
        tvShows: 'series',
        movies: 'vod',
        live: 'live',
    },
    stalker: {
        newPopular: 'vod',
        tvShows: 'series',
        movies: 'vod',
        live: 'itv',
    },
    playlists: {
        newPopular: 'all',
        tvShows: 'groups',
        movies: 'all',
        live: 'all',
    },
};

const SOURCES_PATH = ['/workspace', 'sources'];
const GLOBAL_RECENT_PATH = ['/workspace', 'global-recent'];
/** "My Account" moved into Settings: its first section is the sources. */
export const SIDEBAR_SETTINGS_PATH = ['/workspace', 'settings', 'sources'];

/**
 * The TiagoTV sidebar's fixed links for the active source. Without one,
 * every catalog entry opens the sources page, where the first playlist is
 * added.
 */
export function buildWorkspaceSidebarNav(
    context: WorkspacePortalContext | null
): WorkspaceSidebarNav {
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
                  { highlights: false }
              );

    return {
        main: [
            item('home', 'HOME', 'home', ['/workspace', 'dashboard'], {
                exact: true,
            }),
            sourceItem('movies', 'MOVIES', 'film', 'movies'),
            sourceItem('tv-shows', 'TV_SHOWS', 'tv', 'tvShows'),
            sourceItem('new-popular', 'NEW_POPULAR', 'flame', 'newPopular'),
            item('countries', 'COUNTRIES', 'globe', [
                '/workspace',
                'countries',
            ]),
        ],
        allChannels: sourceItem(
            'all-channels',
            'ALL_CHANNELS',
            'channels',
            'live'
        ),
        saved: [
            item('my-list', 'MY_LIST', 'plus', [
                '/workspace',
                'global-favorites',
            ]),
            item(
                'watch-later',
                'WATCH_LATER',
                'watch-later',
                GLOBAL_RECENT_PATH
            ),
            recentlyAdded,
            item('downloads', 'DOWNLOADS', 'download', [
                '/workspace',
                'downloads',
            ]),
        ],
        // Lit by the shell on every settings page, not by this one link.
        settings: item(
            'settings',
            'SETTINGS',
            'settings',
            SIDEBAR_SETTINGS_PATH,
            {
                highlights: false,
            }
        ),
    };
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
