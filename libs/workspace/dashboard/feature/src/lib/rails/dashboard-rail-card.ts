import type { XtreamFavoriteCatalogStatus } from '@iptvnator/shared/interfaces';
import type { DashboardRemainingLabel } from './dashboard-playback.utils';

/**
 * The dashboard's card model: what a Home row (and the live-EPG
 * presenters that enrich it) knows about one title or channel. It was the
 * upstream `lib-dashboard-rail`'s input; the rail itself left with the
 * upstream rails.
 */
export interface DashboardRailAction {
    id: string;
    labelKey: string;
    icon: string;
    destructive?: boolean;
    disabled?: boolean;
    separatorBefore?: boolean;
}

export interface DashboardRailCard {
    id: string;
    title: string;
    subtitle?: string;
    /** "82% Match", from the catalog rating; cover cards only. */
    matchPercent?: number | null;
    catalogStatus?: XtreamFavoriteCatalogStatus;
    imageUrl?: string;
    icon: string;
    contentType?: 'live' | 'movie' | 'series';
    link: string[];
    queryParams?: Record<string, string>;
    state?: Record<string, unknown>;
    actions?: DashboardRailAction[];
    epgLookupKey?: string;
    /**
     * Playlist the live card belongs to. An XMLTV key is only unique inside
     * the guide its playlist declares, so the dashboard's EPG lookup is
     * grouped and namespaced by that playlist's source scope.
     */
    epgPlaylistId?: string;
    /**
     * Key of the portal (Xtream/Stalker) EPG answer for a live card, asked
     * for lazily once the card is on screen — see
     * `DashboardPortalLiveEpgPresenter`. Unset for M3U cards.
     */
    liveEpgSourceKey?: string | null;
    /**
     * `'pending'` while the card's first portal answer is on its way: the
     * 'channel' layout shows a placeholder instead of the subtitle. A later
     * refresh keeps the previous answer on screen, so it never flashes.
     */
    nowPlayingState?: 'pending' | null;

    /**
     * Optional EPG enrichment shown by the 'channel' rail layout. Populated
     * asynchronously after the card list is computed — when null/undefined
     * the channel card renders without the program subtitle/progress.
     */
    nowPlayingTitle?: string | null;
    /** Localised time range like "12:15 – 13:40". */
    nowPlayingTimeRange?: string | null;
    /** 0–100, % through the current program. */
    nowPlayingProgress?: number | null;

    /**
     * 0–100 watched, attached for movies/series with a resume position so
     * the cover layout can render a thin "watched up to here" bar at the
     * bottom of the poster. Live cards and content without a tracked
     * position leave this unset.
     */
    watchProgress?: number | null;

    /**
     * Localised "S{n} · E{n}" badge for series with a tracked episode
     * position. Renders as a small chip next to the card subtitle so the
     * user can see which episode they were on without opening the show.
     */
    episodeBadge?: string | null;

    /**
     * Localised "12 min left" for Continue Watching cards with a known
     * duration. Sits beside the episode chip in the meta row; absent when
     * the position carries no duration.
     */
    remainingLabel?: DashboardRemainingLabel | null;

    /**
     * Subscription-expiry warning for portal source cards: a quiet amber
     * chip when the account expires soon, an error-toned one once it has.
     * The chip is passive — account details stay behind ⋮ → Account info.
     */
    expiryBadge?: { kind: 'expiring' | 'expired'; label: string } | null;
}

/**
 * Visual layout of the rail's cards.
 *  - 'cover': portrait poster (Netflix-style), used for movies/series and
 *    recently-added catalog items.
 *  - 'channel': compact horizontal info row (logo + channel name + current
 *    program + progress), used for live TV. TV station logos are small, so
 *    inflating them into 2:3 posters wastes space the cards never use.
 */
export type DashboardRailLayout = 'cover' | 'channel';

export interface DashboardRailActionSelection {
    action: DashboardRailAction;
    card: DashboardRailCard;
}
