/** The top bar's tabs, in the capsule's order. */
export type WorkspaceTopBarTabId =
    | 'home'
    | 'sports'
    | 'series'
    | 'movies'
    | 'live'
    | 'my-list';

export interface WorkspaceTopBarTab {
    readonly id: WorkspaceTopBarTabId;
    readonly labelKey: string;
    readonly link: readonly string[];
}

/** Inicio · Deportes · Series · Películas · En vivo · Mi lista. */
export const WORKSPACE_TOP_BAR_TABS: readonly WorkspaceTopBarTab[] = [
    tab('home', 'HOME', 'dashboard'),
    tab('sports', 'SPORTS', 'sports'),
    tab('series', 'SERIES', 'series'),
    tab('movies', 'MOVIES', 'movies'),
    tab('live', 'LIVE', 'countries'),
    tab('my-list', 'MY_LIST', 'global-favorites'),
];

export const WORKSPACE_SPORTS_HUB_PATH = '/workspace/sports';
export const WORKSPACE_SPORTS_HUB_LINK = ['/workspace', 'sports'] as const;
export const WORKSPACE_SETTINGS_LINK = ['/workspace', 'settings'] as const;

/** What the bar shows for one URL. */
export interface WorkspaceTopBarPage {
    /**
     * The tab the page itself belongs to. Null on a page that keeps the
     * tab it was opened from (a title, a channel list): see `fallbackTab`.
     */
    readonly tab: WorkspaceTopBarTabId | null;
    /** A deep page's tab when nothing opened it (a reload, a deep link). */
    readonly fallbackTab: WorkspaceTopBarTabId | null;
    /**
     * A page the bar itself reaches (a tab, Buscar, Ajustes): it has no
     * Back, the bar is the way out.
     */
    readonly isTabRoot: boolean;
    /** A league page: "‹ Deportes" back to the hub replaces Back. */
    readonly isLeague: boolean;
    /** The right-hand circle that is lit. */
    readonly utility: 'search' | 'settings' | null;
    /**
     * The redesigned pages run under the transparent bar in one scroller;
     * the other pages (portal lists with their category panel, players,
     * sources) keep a fixed frame below the bar.
     */
    readonly layout: 'scroll' | 'framed';
}

/** Portal sections and the tab their pages fall back to. */
const SECTION_TABS: Readonly<Record<string, WorkspaceTopBarTabId>> = {
    vod: 'movies',
    series: 'series',
    live: 'live',
    itv: 'live',
    radio: 'live',
    favorites: 'my-list',
    recent: 'my-list',
};

/** The pages of the redesign: they own their padding under the bar. */
const SCROLL_PAGES = new Set([
    'dashboard',
    'sports',
    'series',
    'movies',
    'countries',
    'platforms',
    'search',
    'settings',
    'global-favorites',
    'global-recent',
]);

/** Reads the bar's state for a router URL (query and fragment ignored). */
export function readWorkspaceTopBarPage(url: string): WorkspaceTopBarPage {
    const [path] = url.split(/[?#]/);
    const segments = path.split('/').filter(Boolean);
    if (segments[0] !== 'workspace') {
        return page(null, null, false, 'framed');
    }
    const first = segments[1] ?? 'dashboard';
    const second = segments[2];
    // /workspace/<provider>/<playlist id>/<section>/…
    const section = segments[3];
    const layout = SCROLL_PAGES.has(first) ? 'scroll' : 'framed';
    switch (first) {
        case 'dashboard':
            return page('home', null, true, layout);
        case 'platforms':
            // A streaming platform lives on the Home.
            return page('home', null, false, layout);
        case 'sports':
            return {
                ...page('sports', null, !second, layout),
                isLeague: !!second,
            };
        case 'series':
            return page('series', null, true, layout);
        case 'movies':
            return page('movies', null, true, layout);
        case 'countries':
            return page('live', null, true, layout);
        case 'global-favorites':
            return page('my-list', null, true, layout);
        case 'global-recent':
            // A deep page, reached from another one (the Home hero's
            // "Continuar" opens a title in it): it keeps that page's tab,
            // and lights Mi lista only when opened straight.
            return page(null, 'my-list', false, layout);
        case 'search':
            return { ...page(null, null, true, layout), utility: 'search' };
        case 'settings':
            return { ...page(null, null, true, layout), utility: 'settings' };
        case 'xtreams':
        case 'stalker':
        case 'playlists': {
            const fallback = section ? (SECTION_TABS[section] ?? null) : null;
            return {
                ...page(null, fallback, false, layout),
                utility: section === 'search' ? 'search' : null,
            };
        }
        default:
            return page(null, null, false, layout);
    }
}

/**
 * The lit tab: the page's own, else the one the page was opened from
 * (`previous`, the tab lit before this navigation), else the page's
 * fallback. Buscar and Ajustes light no tab.
 */
export function resolveWorkspaceTopBarTab(
    current: WorkspaceTopBarPage,
    previous: WorkspaceTopBarTabId | null
): WorkspaceTopBarTabId | null {
    if (current.tab || current.isTabRoot) {
        return current.tab;
    }
    return previous ?? current.fallbackTab;
}

function page(
    tabId: WorkspaceTopBarTabId | null,
    fallbackTab: WorkspaceTopBarTabId | null,
    isTabRoot: boolean,
    layout: 'scroll' | 'framed'
): WorkspaceTopBarPage {
    return {
        tab: tabId,
        fallbackTab,
        isTabRoot,
        isLeague: false,
        utility: null,
        layout,
    };
}

function tab(
    id: WorkspaceTopBarTabId,
    labelKey: string,
    path: string
): WorkspaceTopBarTab {
    return {
        id,
        labelKey: `WORKSPACE.TOP_BAR.${labelKey}`,
        link: ['/workspace', path],
    };
}
