export * from './lib/rails/workspace-dashboard-rails.component';
export { PlatformPageComponent } from './lib/platforms/ui/platform-page.component';
export { PlatformThemeService } from './lib/platforms/platform-theme.service';
export { TitlePlatformThemeService } from './lib/title-platform/title-platform-theme.service';
export { TitleVersionsService } from './lib/title-platform/title-versions.service';
export { SportSectionPageComponent } from './lib/sports/ui/sport-section-page.component';
export { SportsHubPageComponent } from './lib/sports/ui/sports-hub-page.component';
export { CountriesPageComponent } from './lib/countries/ui/countries-page.component';
export { SearchPageComponent } from './lib/search/ui/search-page.component';
export { CatalogPageComponent } from './lib/catalog/ui/catalog-page.component';
// The platforms, sports and live channel catalogs, for other features.
export { PlatformsCatalogService } from './lib/platforms/platforms-catalog.service';
// Ajustes → Diagnóstico: what Series, Películas and Buscar are built from.
export {
    CatalogDiagnosticsService,
    type CatalogDiagnosticsCategory,
    type CatalogDiagnosticsKind,
} from './lib/catalog/catalog-diagnostics.service';
export type {
    CatalogRequestEntry,
    CatalogRequestResult,
} from './lib/catalog/catalog-request-log';
export type { StreamingPlatform } from './lib/platforms/streaming-platforms';
export { SportsCatalogService } from './lib/sports/sports-catalog.service';
export { SPORT_SECTIONS } from './lib/sports/sport-sections';
export type { SportSection } from './lib/sports/sport-sections';
export type { LiveChannelTile } from './lib/sports/live-channels';
export * from './lib/rails/dashboard-rail-card';
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
