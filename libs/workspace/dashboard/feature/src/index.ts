export * from './lib/rails/workspace-dashboard-rails.component';
export { PlatformPageComponent } from './lib/platforms/ui/platform-page.component';
export { PlatformThemeService } from './lib/platforms/platform-theme.service';
export { SportSectionPageComponent } from './lib/sports/ui/sport-section-page.component';
export { CountriesPageComponent } from './lib/countries/ui/countries-page.component';
// The shell sidebar's Plataformas / Deportes / Canales en vivo sections.
export { PlatformsCatalogService } from './lib/platforms/platforms-catalog.service';
export type { StreamingPlatform } from './lib/platforms/streaming-platforms';
export { SportsCatalogService } from './lib/sports/sports-catalog.service';
export { SPORT_SECTIONS } from './lib/sports/sport-sections';
export type { SportSection } from './lib/sports/sport-sections';
export type { LiveChannelTile } from './lib/sports/live-channels';
export * from './lib/rails/dashboard-rail.component';
export { resolveDashboardHeroArtwork } from './lib/rails/dashboard-hero.utils';
export type {
    DashboardHeroArtwork,
    DashboardHeroArtworkInput,
    DashboardHeroBackdropSource,
} from './lib/rails/dashboard-hero.utils';
export {
    buildDashboardLiveEpgDetails,
    buildLiveEpgCardsForEnabledRails,
    buildLiveEpgLookupGroups,
    calcEpgProgress,
    formatEpgTimeRange,
    getLiveEpgProgramForCard,
    liveEpgProgramKey,
    liveEpgScopeKey,
} from './lib/rails/dashboard-live-epg.utils';
export type {
    DashboardLiveEpgDetails,
    DashboardLiveEpgLookupGroup,
} from './lib/rails/dashboard-live-epg.utils';
export {
    buildPlaybackPositionReloadKey,
    formatRemainingLabel,
    isContinueWatchingRecentItem,
    playbackProgressPercent,
} from './lib/rails/dashboard-playback.utils';
export type { DashboardRemainingLabel } from './lib/rails/dashboard-playback.utils';
export {
    buildDashboardCollectionViewState,
    buildDashboardRailSeeAllState,
    buildDashboardSourceActions,
    liveRailTitleKeyForSource,
    shouldShowRecentContentSkeleton,
} from './lib/rails/dashboard-rail.utils';
export type {
    DashboardRecentContentSkeletonInput,
    DashboardSourceActionId,
} from './lib/rails/dashboard-rail.utils';
