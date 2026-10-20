import {
    resolvePortalActivityWatchKind,
    type PlaybackPositionData,
    type PortalActivityItem,
} from '@iptvnator/shared/interfaces';
import { withDetailPlayRequest } from '@iptvnator/portal/shared/util';
import type { DashboardDataService } from '@iptvnator/workspace/dashboard/data-access';
import type {
    DashboardHeroAction,
    DashboardHeroSlide,
} from './dashboard-hero.utils';
import type { DashboardHeroSource } from './dashboard-hero-slides.utils';
import { formatRemainingLabel } from './dashboard-playback.utils';

/**
 * Resume slides keep the hero's resume handoff (a saved series episode
 * auto-plays; an Xtream movie's page plays it from the saved position) and
 * always offer "Details" as the detail-only way in;
 * discovery and fallback slides open the detail page; live slides open
 * the channel.
 */
export function dashboardHeroActions(
    data: DashboardDataService,
    source: DashboardHeroSource,
    position: PlaybackPositionData | null
): Pick<DashboardHeroSlide, 'primaryAction' | 'secondaryAction'> {
    switch (source.kind) {
        case 'live':
            return {
                primaryAction:
                    source.origin === 'favorite'
                        ? watchLiveAction(
                              data.getGlobalFavoriteLink(source.item),
                              data.getGlobalFavoriteNavigationState(source.item)
                          )
                        : watchLiveAction(
                              data.getRecentItemLink(source.item),
                              data.getRecentItemNavigationState(source.item)
                          ),
                secondaryAction: null,
            };
        case 'favorite':
            return {
                primaryAction: detailsAction(
                    data.getGlobalFavoriteLink(source.item),
                    data.getGlobalFavoriteNavigationState(source.item)
                ),
                secondaryAction: null,
            };
        case 'added':
            return {
                primaryAction: detailsAction(
                    data.getRecentlyAddedLink(source.item),
                    data.getRecentlyAddedNavigationState(source.item)
                ),
                secondaryAction: null,
            };
        case 'continue':
        case 'recent': {
            const item = source.item;
            const link = data.getRecentItemLink(item);
            const state = data.getRecentItemNavigationState(item);
            if (item.type === 'live') {
                return {
                    primaryAction: watchLiveAction(link, state),
                    secondaryAction: null,
                };
            }
            // The fallback row can be a finished title (the resume
            // candidates skip those): nothing to continue, open details.
            if (source.kind === 'recent') {
                return {
                    primaryAction: detailsAction(
                        link,
                        data.getRecentItemDetailNavigationState(item)
                    ),
                    secondaryAction: null,
                };
            }
            // "Más info" always (the Home's hero offers both): the
            // detail page without the resume handoff.
            return {
                primaryAction: {
                    labelKey: 'WORKSPACE.DASHBOARD.HERO_CONTINUE',
                    icon: 'play_arrow',
                    link,
                    state: withMovieResume(item, link, state),
                    remainingLabel: formatRemainingLabel(position),
                    testId: 'dashboard-hero-primary-action',
                },
                secondaryAction: {
                    ...detailsAction(
                        link,
                        data.getRecentItemDetailNavigationState(item)
                    ),
                    testId: 'dashboard-hero-secondary-action',
                },
            };
        }
    }
}

/**
 * Continue on an Xtream movie resumes it: its page plays from the saved
 * position (a series' episode has its own handoff, `seriesResume`).
 */
function withMovieResume(
    item: PortalActivityItem,
    link: string[],
    state: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
    const contentId = Number(item.xtream_id);
    return item.source === 'xtream' &&
        item.type === 'movie' &&
        resolvePortalActivityWatchKind(item) !== 'series' &&
        Number.isInteger(contentId) &&
        contentId > 0
        ? withDetailPlayRequest({ link, state }, { mode: 'resume', contentId })
              .state
        : state;
}

function watchLiveAction(
    link: string[],
    state: Record<string, unknown> | undefined
): DashboardHeroAction {
    return {
        labelKey: 'WORKSPACE.DASHBOARD.HERO_WATCH_LIVE',
        icon: 'play_arrow',
        link,
        state,
        testId: 'dashboard-hero-primary-action',
    };
}

function detailsAction(
    link: string[],
    state: Record<string, unknown> | undefined
): DashboardHeroAction {
    return {
        labelKey: 'WORKSPACE.DASHBOARD.HERO_DETAILS',
        icon: 'info',
        link,
        state,
        testId: 'dashboard-hero-primary-action',
    };
}
