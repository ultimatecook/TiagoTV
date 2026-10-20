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
    /**
     * A deep page that keeps the tab it was opened from (a title, a
     * platform-less list). False where the page lights its own tab or none
     * (Buscar, Ajustes, Fuentes, Descargas).
     */
    readonly keepsTab: boolean;
    /** The right-hand circle that is lit. */
    readonly utility: 'search' | 'settings' | null;
    /**
     * The redesigned pages run under the transparent bar in one scroller;
     * the other pages (portal lists with their category panel, players,
     * sources) keep a fixed frame below the bar.
     */
    readonly layout: 'scroll' | 'framed';
}

/**
 * Portal sections and their tab: a section's own lists light it, and a
 * title inside one falls back to it.
 */
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
        case 'sources':
        case 'downloads':
            // Behind the source switcher, not a tab.
            return { ...page(null, null, false, layout), keepsTab: false };
        case 'xtreams':
        case 'stalker':
        case 'playlists':
            return readPortalPage(segments, layout);
        default:
            return page(null, null, false, layout);
    }
}

/**
 * /workspace/<provider>/<id>/<section>/…: a section's lists light its tab
 * (live En vivo, vod Películas, series Series), a title in it
 * (`vod|series/<category>/<item>`) keeps the tab it was opened from, its
 * search lights Buscar and its downloads no tab.
 */
function readPortalPage(
    segments: readonly string[],
    layout: 'scroll' | 'framed'
): WorkspaceTopBarPage {
    const section = segments[3];
    const sectionTab = section ? (SECTION_TABS[section] ?? null) : null;
    if (section === 'search') {
        return {
            ...page(null, null, false, layout),
            keepsTab: false,
            utility: 'search',
        };
    }
    if (section === 'downloads') {
        return { ...page(null, null, false, layout), keepsTab: false };
    }
    const isTitle =
        (section === 'vod' || section === 'series') && segments.length > 5;
    return sectionTab && !isTitle
        ? page(sectionTab, null, false, layout)
        : page(null, sectionTab, false, layout);
}

/** The page navigated from, and the tab it lit. */
export interface WorkspaceTopBarOpener {
    readonly page: WorkspaceTopBarPage | null;
    readonly tab: WorkspaceTopBarTabId | null;
}

/**
 * The lit tab after a fresh navigation (history Back and Forward restore
 * the tab their entry lit instead, see `WorkspaceTopBarTabMemory`): the
 * page's own, or none. A deep page keeps its opener's tab when a tab's own
 * page opened it (a title from Películas or Inicio); opened from another
 * deep page or from nowhere (a reload, a deep link), its section decides,
 * else the tab lit before. Buscar, Ajustes, Fuentes and Descargas light no
 * tab.
 */
export function resolveWorkspaceTopBarTab(
    current: WorkspaceTopBarPage,
    opener: WorkspaceTopBarOpener | null
): WorkspaceTopBarTabId | null {
    if (!current.keepsTab) {
        return current.tab;
    }
    const openerTab = opener?.page?.tab ?? null;
    if (openerTab && !opener?.page?.keepsTab) {
        return openerTab;
    }
    return current.fallbackTab ?? opener?.tab ?? null;
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
        // A page with a tab of its own, or a tab's own page, keeps none.
        keepsTab: !tabId && !isTabRoot,
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
