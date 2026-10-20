/**
 * The Home's catalog rules without Angular, the DOM or storage: which live
 * channels "En vivo" keeps per country, today's matches from the event
 * channels, and the streaming platforms' shelves.
 *
 * TiagoTV liviano (apps/webos-lite, the LG TV app) bundles this entry for
 * Chrome 53, so the TV and the desktop app sort the same catalog the same
 * way. Every module reached from here must stay framework-free: that app's
 * build fails when Angular code reaches its bundle.
 */
export {
    buildCountriesTv,
    type CountriesCatalogCategory,
    type CountriesCatalogStream,
    type TvCountry,
} from './lib/countries/countries-catalog';
export {
    COUNTRIES,
    countryOfCategory,
    type CountryDefinition,
} from './lib/countries/countries';
export type { RowLabel, TvRow } from './lib/countries/country-rows';
export type {
    CountryChannel,
    CountryChannelGroup,
} from './lib/countries/country-channels';

export {
    buildSportsCatalog,
    orderMatches,
    todaysMatches,
    type SportMatch,
    type SportsCatalog,
    type SportsCatalogCategory,
    type SportsCatalogStream,
} from './lib/sports/sports-catalog';
export { isMatchOn, isMatchOver, startOf } from './lib/sports/match-clock';
export {
    SPORT_SECTIONS,
    type SportSection,
    type SportSectionId,
} from './lib/sports/sport-sections';
export {
    followedTeamOf,
    isFollowedTeam,
    MY_TEAMS,
    teamFixtures,
    type FollowedTeam,
} from './lib/sports/my-teams';
export { teamDisplayName } from './lib/sports/team-names';

export {
    buildPlatformShelves,
    STREAMING_PLATFORMS,
    type PlatformCatalogCategory,
    type PlatformCategory,
    type PlatformShelf,
    type PlatformTitleKind,
    type StreamingPlatform,
} from './lib/platforms/streaming-platforms';
export {
    languagesLabel,
    languageVersions,
    toPlatformTitles,
    type PlatformCatalogItem,
    type PlatformTitle,
    type PlatformTitleVersion,
} from './lib/platforms/platform-titles';
export { mergePlatformTitles } from './lib/platforms/platform-versions';

// Series / Películas, the platform pages and the Home's picks (TiagoTV
// liviano's catalog screens), as the desktop app builds them.
export {
    aggregateCatalog,
    buildCatalogRows,
    CATALOG_GENRES,
    featuredTitle,
    pickNewReleases,
    type CatalogRow,
    type CatalogTitle,
    type PlatformTitleList,
} from './lib/catalog/catalog-titles';
export { takeTurns } from './lib/catalog/catalog-fairness';
export {
    buildPlatformRows,
    byDailyRating,
    topRated,
    type PlatformRow,
} from './lib/platforms/platform-rows';
export { pickRecommendations, titleExtras } from './lib/platforms/platform-hero';
export { daySeed, seededUnit } from './lib/platforms/platform-seed';
export {
    genreLabelKey,
    genresIn,
    type PlatformGenre,
} from './lib/platforms/platform-genres';
export { titleKey } from './lib/platforms/platform-titles';
export {
    buildGenreCategories,
    findStreamingPlatform,
    type StreamingPlatformId,
} from './lib/platforms/streaming-platforms';
export {
    platformDesign,
    type PlatformDesign,
} from './lib/platforms/platform-design';
export {
    pickSeriesForYou,
    rankTopMovies,
    seriesBadge,
    seriesName,
    type HomeSeriesBadge,
} from './lib/rails/home-platform-titles';
export {
    homeEventRow,
    homeEventsSummary,
    selectHomeEvents,
    type HomeEventRow,
} from './lib/rails/home-events';
export {
    competitionLogo,
    findSportSection,
    SPORTS_ROW,
} from './lib/sports/sport-sections';
export type {
    SportChannel,
    SportSectionContent,
} from './lib/sports/sports-catalog';
export {
    countryCards,
    countryCategories,
    type TvCard,
    type TvCategory,
    type TvCategoryId,
} from './lib/countries/country-tv-categories';
export { foldTerm, matchRank } from './lib/search/search-results';
export {
    parseEspnTable,
    type LeagueTable,
    type LeagueTableRow,
    type TableZone,
} from './lib/sports/league-table-sources';
export type { TeamFixture } from './lib/sports/my-teams';

// TiagoTV liviano's sports board: which live categories hold event
// channels, the kick-offs remembered across loads, and the team crests,
// as the desktop's sports service reads them.
export { KickoffMemory } from './lib/sports/match-clock';
export { isIdleEventChannel, parseSportEvent } from './lib/sports/sport-events';
export {
    channelInSection,
    sectionForCompetition,
} from './lib/sports/sport-sections';
export { sectionsWithChannels } from './lib/sports/match-channels';
export { isSameTeam, teamKey } from './lib/sports/team-names';
export { TeamCrestResolver } from './lib/sports/team-crests';
export { SportsApiClient } from './lib/sports/sports-api-client';
