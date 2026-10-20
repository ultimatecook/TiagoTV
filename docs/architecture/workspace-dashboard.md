# Workspace Dashboard

This document records the current dashboard implementation inside the workspace
shell.

Related:

- [Workspace Shell](./workspace-shell.md)

## Summary

- The dashboard is the default `/workspace` landing page.
- It is a **rail-based** content surface (Netflix / Apple TV pattern), not a
  customizable widget grid.
- Layout order is static and curated — there is no edit mode, drag-drop, or
  size stepper. Each section has a persisted show/hide switch
  (`Settings.dashboardRails`, `DashboardRailsSettings` in
  `libs/shared/interfaces/src/lib/settings.interface.ts`, surfaced under
  Settings → Inicio); every section is gated by `dashboardRails().<key>`.
  Sections additionally auto-hide when empty.
- First-run users see the shared welcome empty-state with a single primary
  CTA to add their first playlist.

Core implementation:

1. `libs/workspace/dashboard/feature/src/lib/rails/workspace-dashboard-rails.component.ts`
   — the page-level facade.
2. `libs/workspace/dashboard/feature/src/lib/rails/home-*.component.ts`
   — the Home's sections (events, Top 10, series, last channels) and
   `dashboard-rail-card.ts`, the card model the live-EPG presenters enrich.
3. `libs/workspace/dashboard/data-access/src/lib/dashboard-data.service.ts`
   — data aggregation (recent items, favorites, playlist stats). Shared across
   rails.
4. `libs/playlist/shared/ui/src/lib/recent-playlists/empty-state/empty-state.component.ts`
   — reused welcome state with the primary "Add your first playlist" CTA.

## Page Structure

TiagoTV's Home follows the redesign handoff ("01 · Inicio"): one column of
sections 44px (`--tv-section-gap`) apart under the shell's transparent top
bar, the page padded `--tv-page-top --tv-page-x --tv-page-bottom`.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Seguir viendo — hero slider, bleeding up behind the top bar        │
├─────────────────────────────────────────────────────────────────────┤
│  Plataformas      [logo card][logo card][logo card] →→              │
├─────────────────────────────────────────────────────────────────────┤
│  Deportes         [competition][competition] →→ (lib-sports-rail)   │
├─────────────────────────────────────────────────────────────────────┤
│  Eventos de hoy · N en vivo · N eventos                  Ver todo   │
│  [one list card, 60px rows]                                         │
├─────────────────────────────────────────────────────────────────────┤
│  Top 10 películas hoy · En tus plataformas               Ver todo   │
│  [1 poster][2 poster][3 poster] →→                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Series para vos                                         Ver todo   │
│  [featured][stacked / stacked]                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Últimos canales vistos                                  Ver todo   │
│  [channel][channel][channel][channel] →→                            │
└─────────────────────────────────────────────────────────────────────┘
```

Sections and data (all under `libs/workspace/dashboard/feature/src/lib`):

1. Hero — `rails/dashboard-hero.component.*` over
   `DashboardHeroSlidesPresenter` (see [Cinematic Hero](#cinematic-hero)):
   up to five slides, every unfinished title first. A slide shows its
   platform's logo when its catalog category belongs to one
   (`platformOfCategory`, `rails/home-platform-titles.ts`). Gated by
   `dashboardRails().hero`, and rendered only while it has slides or its
   skeleton: with nothing to feature over a real backdrop there is no
   hero.
2. Platforms — `platforms/ui/platforms-rail.component.*`
   (`PlatformsCatalogService.shelves()`, from the stored category lists).
3. Sports — `sports/ui/sports-rail.component.*` (the sports views' card row).
4. "Eventos de hoy" — `rails/home-events.*`: `SportsCatalogService.today()`
   in one list, the ones on now first, at most eight rows
   (`selectHomeEvents`: a match of the owner's teams further down takes the
   last other place). Scores and minutes are not in the provider's data: a
   row says "En vivo" or its kick-off. The channel column names the
   broadcaster from the event feed's category, or a match's first `via`
   channel, which a click plays on the match's competition page, the match
   in focus (its key in the navigation state, `playRequestMatch`) so the
   stage lists its signals in every language. A feed filed under another sport's
   category (a Ligue 1 match under Formula 1, `namesOtherSport`) names no
   channel, and a card's logo that is one competition's (Básquet's NBA logo,
   `SportSection.logoCompetition`) shows on that competition's rows only.
5. "Top 10 películas hoy" and 6. "Series para vos" —
   `rails/home-top-movies.*`, `rails/home-series.*` over
   `HomePlatformTitlesService`: the platforms' aggregated catalog
   (`CatalogService.titles`, the stored catalog first — no provider
   request — and, only when nothing is stored, the same first-run import
   in Electron or the platforms' lists in turns, shared with Series /
   Películas: see Series and Movies Catalog), ranked by `rankTopMovies`
   and `pickSeriesForYou` with the day's seed. Nothing is read until a
   section comes within 400px of the
   scroller's view (`HomeNearDirective`). Meta lines are the catalog's
   (`posterMeta`, `heroMeta`); the featured show's page is asked once for
   its seasons (`CatalogService.loadExtras`). The Home asks title pages one
   at a time, the hero's and this section's in one queue
   (`HomeTitlePagesService`): the provider allows one connection. The Top
   10's places are sized from the section's width (`container-type:
   inline-size`, `100cqi`, up to the rows' 1800px limit — see
   [Redesigned pages](#redesigned-pages-shared-rules-tiagotv)): about 4.6
   in view, every poster as wide
   (≈ 250px at the design's 1512px) with its outlined number scaled to it;
   the row is tracked by place, since a snapping row re-snaps to the element
   it rested on and followed the first title one place in when the ranking
   reordered while the platforms loaded. Series badges come only from
   the catalog entry (`seriesBadge`: "Estreno", "Temporada N" from a
   season marker, "Nuevo episodio" for an older show updated this week).
   "Mi lista" toggles the source's favourite when the title is in the
   stored catalog (`HomeMyListService`), else opens the title's page.
   "Empezar T1·E1" opens the show's page playing its first episode
   (`CatalogService.play(title, 'first-episode')`, see Detail play requests
   below); a click elsewhere on the card opens the page.
7. "Últimos canales vistos" — `rails/home-recent-channels.*`:
   `globalRecentLiveItems()`, the programme and its progress from the
   page's `DashboardLiveEpgPresenter` (asked for the cards in view once the
   row comes near). Gated by `dashboardRails().recentlyWatchedLive`.

The sideways rows (platforms, sports, Top 10, last channels) scroll on x
only: `overflow-x: auto` alone computes `overflow-y` to `auto` too, and the
Top 10's tall number glyph boxes gave its row some 40px of vertical scroll
that caught the wheel. Each declares `overflow-y: hidden`, with padding
plus a negative margin for a lifted card's focus ring, so the wheel over a
row scrolls the page (`row-edges.spec.ts`).

Title images are asked for at the size they are drawn
(`sharpImageUrl` in `@iptvnator/shared/interfaces`, the feature's
`sharpImage` pipe): provider catalogs point at small TMDB copies (w185
posters, w780 backdrops) that a large card or hero on a 2× screen showed
upscaled and blurry. A plain `image.tmdb.org/t/p/<size>/` link is raised to
the smallest TMDB width covering the CSS width × `devicePixelRatio` (never
lowered); any other URL — a provider's own image link may carry the
account — is used exactly as given. The Home's rows and hero, Series /
Películas, the platform pages and the title page's hero
(`ContentHeroComponent`) use it.

A section with nothing to show renders nothing and the page's
`> :empty { display: none }` leaves it out of the gap rhythm. The upstream
rails (New & Popular, favourites, sources, TMDB trending and
recommendations, their skeletons) and the old "Partidos de hoy" and
"Canales en vivo" rows are no longer on the Home. Settings → Inicio has a
switch per section, top to bottom: `hero` ("Seguir viendo"), `platforms`,
`sports`, `events`, `topMovies`, `seriesForYou`, `recentlyWatchedLive`
(a key a stored setting lacks is on). The old rails' keys
(`continueWatching`, `liveFavorites`, `favoriteMoviesAndSeries`,
`recentSources`, `xtreamRecentlyAdded`, `tmdbTrending`,
`tmdbRecommendations`) have no switch and no section, but stay in the
stored settings as they were. "Empezar en Inicio" (`showDashboard`) only
picks the first page (Inicio, else Fuentes): the top bar keeps Inicio and
the section switches stay editable either way.

Render rules:

1. Home sections render independently as their data sources resolve. The
   page does not use `dashboardReady()` as a page-wide skeleton gate. The
   hero shows its own skeleton (below); "Top 10" and "Series para vos" show
   placeholder cards while the platforms' lists load for the first time.
2. `hasPlaylists() === false` → render `<app-empty-state [type]="'welcome-dashboard'">`
   full-bleed. All rails and the hero are skipped.
3. The hero (`lib-dashboard-hero`) renders when it has at least one slide;
   see [Cinematic Hero](#cinematic-hero). It shows its own skeleton while
   it has no slide and any of its sources (history and its playback
   positions, favorites, Xtream recently added, the stored catalog) is still
   on its first load, the first discovery backdrop is still being looked
   for (at most `DASHBOARD_HERO_DISCOVERY_WAIT_MS`, 5 s), or a live
   candidate still
   waits for its first programme answer (portal or XMLTV, for at most
   `DASHBOARD_HERO_LIVE_ANSWER_WAIT_MS`, 2 s, from the hero's creation).
   Dropping it earlier removed the hero and inserted it again when a later
   source featured a title, moving every rail below twice. Once the
   skeleton has gone it does not come back. An item enters recent history only after
   its stream has really played (see "Recently Viewed Confirmation" in
   `embedded-inline-playback.md`), so a channel that failed at once never
   becomes a hero slide.
4. Each section is emitted via `@if` on its own data. Empty sections are
   hidden — there is no "empty widget" placeholder.
5. Hero slides prefer a stored `backdrop_url`, then the TMDB backdrop, at
   the window's width (`heroBackdropUrl`). Only a resume slide may go
   without one, its poster standing on the right of the title-tinted
   gradient (a live slide: its channel logo); a discovery or fallback slide
   without a backdrop, or whose backdrop fails to load, is left out — a
   poster on the tinted stage looked broken.

## Cinematic Hero

`DashboardHeroComponent` is the Home's "Seguir viendo" slider (handoff
"01 · Inicio", 1). Its host bleeds up behind the top bar and out to the
window's edges (`margin: calc(-1 * (--tv-topbar-h + --tv-page-top))
calc(-1 * --tv-page-x) -16px`), the banner is
`clamp(460px, calc(100vh - 560px), 620px)` tall at least, and its whole
background carries `mask-image` so it fades into the page instead of ending
on an edge. Each slide's background is its backdrop, else (resume and live
slides only) a poster or a channel logo standing on the right of the
gradient in the title's hue (`--hero-hue`), crossfading in 700ms under a
left and a top veil.

Height: that clamp is a floor, not a fixed height. Every slide's content is
laid out in the same grid cell at the bottom of the banner, so it is as tall
as its tallest slide whichever one is shown, and a rotation never resizes it
or moves the rows below. Only the active slide is shown; the others are
`inert` and `visibility: hidden`.

Slides (`pickDashboardHeroSources`, at most five, stable order, each title
once):

1. every unfinished movie/series, most recent first
   (`continueWatchingItems()`: a finished movie skips, a series features the
   episode it continues with);
2. a live channel with a programme on air — the first of
   `selectDashboardHeroLiveCandidates` (up to three favourites, then two
   recently watched channels) whose EPG answer has a title;
3. remaining places round-robin over the favourite movies/series with a
   backdrop (their own, or TMDB's: the first four without one are looked
   up) and Series / Películas' newest titles (`catalogHeroCandidates` over
   `CatalogService`: one title per show, in Spanish where it has a Spanish
   version, the platforms taking turns as in the catalog's "Novedades",
   movies and series in turn). The stored rows carry posters only (series
   lists sometimes a backdrop), so `HomeHeroBackdropsService` features a
   candidate only once its 16:9 backdrop is known and has loaded once,
   landscape (`HERO_IMAGE_CHECK`): rows that name one first, asking
   nothing, then the others' pages one at a time through
   `HomeTitlePagesService`, at most `HERO_BACKDROP_PROBES` (8) a session,
   up to `HERO_DISCOVERY_SLIDES` (4) titles; one without a backdrop is
   skipped. It is root-provided and looks once per source, so a later
   visit asks nothing again. Only the stored catalog is read for them
   (`CatalogService.loadStored`, never the platforms' lists: no provider
   request, and no wait for a section's first-run import, whose titles
   join once it stored them); while it is read they are held back (the
   skeleton waits if nothing else is to show), and only when nothing is
   stored do the provider's raw recently-added rows stand in;
4. only when nothing qualifies, the newest history row of any kind (a
   detail action: it can be a finished title). It waits for
   `continueWatchingSettled()`.

While live candidates exist but none has answered yet, one place stays
reserved for the live slide, so its late arrival never evicts a slide the
user may be viewing. The live candidates are derived and pinned by
`DashboardLiveEpgPresenter` itself. TMDB extras (backdrop, rating, genres,
overview, year) come from `DashboardHeroTmdbService` per featured title and
vanish when TMDB is off.

A slide reads, top to bottom: "SEGUIR VIENDO" over an unfinished title (its
reason otherwise: favourite channel, recently added…), its platform's logo
when its catalog category belongs to one, the title in Bebas Neue, the
watch progress (`--app-progress-color`; a live programme's elapsed share in
`--app-live-color`) beside "T2·E5 · Quedan 23 min" / "Película · …"
(`heroMetaParts`), then Continue (the resume handoff: a series' saved
episode auto-plays, an Xtream movie's page plays it from the saved
position through a detail play request) and More info (detail only). Series titles drop their season marker
(`splitSeasonSuffix`).

Semantics: the page has one stable, visually hidden `h1`
(`dashboard-page-heading`); each slide title is an `h2`. Slide changes are
announced by one polite live region (`dashboard-hero-announcement`) outside
the slides, silent while the slides rotate on their own. A slide's progress
bar is named after its title (a live slide: the programme).

Rotation: every 6 s (`HERO_ROTATION_MS`). The indicators are 6px bars (the
active one 28px and white, 300ms width transition) with a larger invisible
hit area; the active one carries an invisible timer animation
(`hero-slide-timer`, `transform` only) whose `animationend` advances, so
picking a slide restarts the timer. The pointer or focus inside the hero
and a hidden document pause it; under `prefers-reduced-motion` nothing
auto-advances. The hero is a focusable region: ←/→ switch slides and Enter
follows the primary action. The active slide is tracked by id, so a late
live slide never moves the user off the current one. Test hooks:
`dashboard-hero`, `dashboard-hero-slide` (`data-hero-kind`),
`dashboard-hero-dot`, `dashboard-hero-primary-action`,
`dashboard-hero-secondary-action`. `dashboard-hero-rotation.e2e.ts` drives
the real timer animation (with a shortened `--hero-rotation-ms`).
`dashboard-hero-legibility.e2e.ts` still measures the previous hero's
light/dark and narrow layouts and needs rewriting for this one.

## Rail Contract

TiagoTV: `DashboardRailComponent` (`lib-dashboard-rail`) and its geometry
partial were removed once the Home stopped using them; its card model
lives on in `rails/dashboard-rail-card.ts`. The contract below records the
upstream rail.

`DashboardRailComponent` is purely presentational:

1. Inputs: `label`, `items: DashboardRailCard[]`, optional `seeAllLink`,
   optional `aspectRatio` (default `'2 / 3'`), optional `testId`.
2. Behavior: horizontal flex track with `scroll-snap-type: x mandatory`.
   The track scrolls back to the start and re-observes its cards only when
   the ids or order of `items` change. Hosts rebuild card objects on every
   clock tick (live progress, expiry badges), and such a rebuild must not
   move a rail the user scrolled.
3. Chevron buttons fade in on hover (desktop only via `@media (hover: none)`).
   Edge fades follow the chevrons' visibility. The track bleeds
   `--rail-bleed` past the viewport on every side so card focus rings and
   hover lift are not clipped; the fades are offset by the same variable so
   they reach the track's clipping edge and no card strip shows beyond them.
   The TiagoTV Home and the platform pages set `--rail-bleed` to their
   gutter, so every sideways row (these rails, the platforms, sports,
   matches and live channels rows, a platform page's rows, the by-country
   rows) runs on through both gutters to the content's edges: scrolled
   cards slide out at the window's edge with the sidebar hidden and at the
   sidebar's edge otherwise, while the first card rests on the gutter under
   the title. The custom rows take their start bleed as `--rail-bleed-start`
   (the page's `--rail-bleed`, at least 12px) and snap to it
   (`row-edges.spec.ts`).
4. Cards are keyboard-focusable router links; `scroll-snap-align: start`
   means arrow-key nav lands on card boundaries. A card that receives
   keyboard or script focus scrolls fully into the viewport: Chromium skips
   its own focus scroll once 32px of an element shows, so the track's
   `focusin` handler moves to the first card-start snap position revealing
   the whole card (a card wider than the viewport aligns at its own start).
   Focus caused by a press inside the track (within 100ms of `pointerdown`,
   650ms for touch) leaves the rail still, so the card does not slide from
   under the pointer before the click.
5. Image handling: `loading="lazy"`, `decoding="async"`, fallback icon tile
   when `imageUrl` is missing or `error` fires.
6. Dashboard hero, rail containers, rail viewports and tracks, rail cards and
   their links, and "Manage all" links expose stable `data-test-id` hooks. Treat these as the supported Electron E2E
   selector surface; do not target internal CSS class names.

## Data Flow

TiagoTV: the Home reads the history (hero, last channels), the favourites
and, without a stored catalog, Xtream recently-added titles (hero discovery
slides only), the playback
positions and the live EPG presenters below; the upstream rails' card
builders, their skeleton gates (`dashboard-rail-skeletons.ts`,
`dashboard-skeleton-grace.ts`), the TMDB rails' loader
(`dashboard-tmdb-rails.ts`) and the sources' expiry clock were removed with
those rails. The steps that describe them record the upstream design.

1. `WorkspaceDashboardRailsComponent` injects `DashboardDataService`.
2. It derives the dashboard surface via `computed()`:
    1. The hero slides — built by `DashboardHeroSlidesPresenter`, see
       [Cinematic Hero](#cinematic-hero).
    2. `continueWatchingCards` — maps `continueWatchingItems()` to movie/series
       cover cards. The list and its loading gate are built by
       `createDashboardContinueWatching` (`dashboard-continue-watching.ts`)
       from the history and the playback positions `DashboardDataService`
       holds, which exposes them as `continueWatchingItems()` and
       `continueWatchingSettled()`. A movie stays until its position reaches
       `PORTAL_WATCHED_PROGRESS_PERCENT` (`isPortalPlaybackWatched`). The
       threshold is 90%, the Plex/Jellyfin/Emby/Kodi default, so stopping
       during the end credits finishes a title, as does "Mark watched". A
       series stays while it has something to continue: once its newest
       episode is watched, or is an extra (season 0),
       `DashboardSeriesEpisodesService` fetches its episode list
       (`get_series_info`, two lookups at a time) and
       `resolveDashboardSeriesContinuation` applies
       `getSeriesNextUp`, the rule the series page's quick start follows
       too. Like Plex's On Deck and Jellyfin's Next Up it goes on from the
       episode watched last, not from the first gap in the list: the first
       episode after it that is not watched, so a series started at season
       2 or with an episode skipped (or left unfinished) goes on after the
       episode actually watched. A started next episode resumes where it was
       left. Extras (season 0) stand apart when the series has other
       seasons: they never come next, never keep the series on the rail and
       never take its card, not even one left unfinished; a series filed
       under season 0 alone has them as its run. The card then shows and
       resumes that episode; a next episode not started yet is a
       synthesized row at 0:00 without duration, so it carries the S·E
       badge but no progress, remaining time or "Mark watched". The series
       leaves once no unwatched episode follows the one watched last, even
       if an earlier one was skipped or extras are left. Until its list is
       in (loading, failed, empty, or not holding the episode played last:
       a list cached before that episode is fetched again in the next
       round), for
       series that cannot be looked up (Stalker), and for series never
       looked up, a series keeps its newest episode rather than vanish on a
       guess. `planDashboardSeriesLookups` picks the series to look up:
       newest first until `CONTINUE_WATCHING_VISIBLE_ITEMS` (20, the rail's
       `RAIL_ITEM_LIMIT`) titles are known to stay listed, counting movies
       and series that need no lookup; a finished series frees its slot, so
       an older one is looked up next, up to
       `CONTINUE_WATCHING_SERIES_LOOKUP_LIMIT` (40) lookups. Lists are kept
       per session and per source (server and username: an edited playlist
       is looked up again, and a late answer for the old source is
       dropped). Lookups are background requests (`suppressErrorLog`: a
       failure is logged, never a toast). Each `reloadPlaybackPositions()`
       that lands (dashboard entry, a changed history, "Mark watched") is a
       lookup round: a failed lookup is tried again once
       `DASHBOARD_SERIES_EPISODES_RETRY_DELAY_MS` (5 min) has passed (at
       once when the playlist's password is corrected), and a list older
       than `DASHBOARD_SERIES_EPISODES_MAX_AGE_MS` (1 h) is fetched again so
       newly added episodes show up, the old list standing until the new
       one arrives (a failed refresh keeps it, and waits for the same delay).
       A source that failed two lookups in a row is not asked for its other
       series until the delay has passed either: a portal that is down or
       expired costs two requests per delay, not one per series per dashboard
       visit. Within one round, more
       series to look past never repeat a request, and the request list
       compares by value, so playlist store churn elsewhere in the app does
       not trigger lookups. Finished titles
       stay in `globalRecentVodItems()` and on the Global Recent page ("See
       all");
       the rail's count badge counts only the listed ones. The list stays
       empty until `continueWatchingSettled()`: the history has loaded (on
       the PWA that includes its Xtream data-source read, not only the
       playlist inventory), `reloadPlaybackPositions()` has covered every
       playlist in it once, and the episode lists the first open asked for
       have answered or `CONTINUE_WATCHING_SERIES_LOOKUP_WAIT_MS` (2 s) has
       passed, so on first open the rail inserts once instead of listing
       finished titles and dropping them a moment later. A playlist whose
       positions failed to load counts as covered. The gate stays open
       afterwards: like the history, a dashboard opened again first renders
       the positions it already holds and refreshes them on entry, so a title
       finished since the last visit leaves the rail, or a series moves on to
       its next episode, when that refresh (and, for a series not looked up
       yet this session, its episode list) lands.
       `reloadPlaybackPositions()` applies only its latest call's result, so
       an older read finishing last cannot bring finished titles back.
       Portal playback positions are bulk-loaded per playlist
       (`loadDashboardPlaybackPositions`), every playlist at once (one `Promise.all`, not one await per playlist: the
       single-threaded DB worker then answers the set in one pass, and a
       long request it is busy with delays the set once, not once per
       playlist), so hero and cards can show progress, remaining time, and
       series season/episode badges. Whether an item is looked up as a movie (one `vod`
       row) or a series (episode rows under the parent id) is its WATCH
       kind, `resolvePortalActivityWatchKind`, not its routing `type`. The
       shape that needs the distinction is a Stalker embedded-VOD row: its
       stored entry carries a `series[]` episode array but no `is_series`
       flag, so `extractStalkerItemType` reports `movie` (deliberately — the
       item belongs in the VOD catalog) while its progress lives in episode
       rows. The mappers give both it and a lazy Ministra `is_series` row
       (already typed `series`) `watch_kind: 'series'`. Series lookup uses
       keyed maps for both direct episode ids and parent series ids; card
       renders must not scan the full playback-position map. A series'
       newest row is the latest `updatedAt`; rows saved in the same second
       (SQLite keeps whole seconds, and "Mark season watched" stamps a
       season at once) go to the later episode, as `getSeriesNextUp` breaks
       the tie. The badge uses saved `seasonNumber` /
       `episodeNumber` metadata and does not infer it from provider payloads;
       legacy rows without that metadata remain badge-less until replay.
       Dashboard-originated Xtream and Stalker series clicks also carry that
       exact episode target through the global-recent inline-detail handoff.
       Once the series metadata and playback positions load, the detail player
       consumes the target once and resumes the saved episode. Opening the same
       item normally from the global recent grid remains a detail-only action.
       Continue Watching cards carry no provider/content-kind subtitle: their
       meta row is the S·E chip plus a "N min left" label (`remainingLabel`,
       from `formatRemainingLabel`), and the row is not rendered when both are
       absent. The hero subtitle is the source name alone, through
       `playlistDisplayLabel`.
    3. `liveFavoriteCardsEnriched` and `recentLiveCardsEnriched` — two
       independent rails (`dashboard-live-favorites-rail` and
       `dashboard-recent-live-rail`); there is no fallback from one to the
       other. M3U cards carry an `epg_lookup_key` using the app-wide XMLTV
       fallback order (`tvg-id` -> `tvg-name` -> channel name); EPG enrichment
       must use that key before falling back to the card title. Both rails are
       enriched by `DashboardLiveEpgPresenter`, the one component-provided
       facade for live EPG: it owns the XMLTV lookup described under "Scoped
       lookups" in `m3u-playlist-module.md`, forwards everything portal-shaped
       to `DashboardPortalLiveEpgPresenter`, and `enrich()` returns the cards
       with their "now on air" row filled in.
       One component-provided `DashboardLiveEpgClock` drives every live
       refresh and progress bar on the page. It ticks every 30 s only while
       the XMLTV lookup has cards or the portal presenter wants one, and
       only while the document is visible; it reads the clock at once when
       it starts again. A tick re-reads progress for every live card. It
       re-asks an XMLTV scope only after one of its programmes has ended,
       while a key has no programme, or once the answer is five minutes old
       (`LIVE_EPG_MAX_ANSWER_AGE_MS`), because a guide refreshed elsewhere
       can correct a programme still on air. A guide import or source change
       (`EpgService.epgAvailable$`) re-asks at once. An unchanged answer is
       not re-emitted.
       Xtream and Stalker cards have no XMLTV key of their own; their "now on
       air" line comes from the portal, **lazily and per card**:
        - `buildDashboardPortalLiveEpgEntry` (dashboard data-access) turns a
          live `PortalActivityItem` into the `UnifiedCollectionItem` the
          collection pages hand `StreamResolverService.loadEpgForItems`, keyed
          by the collection uid — favourites and recent rows of one channel
          share the answer. Radio rows and rows without a usable provider id
          get no entry. Cards carry that key as `liveEpgSourceKey`.
        - `lib-dashboard-rail` reports the cards inside its track viewport
          (plus ~one card of `rootMargin`) through `visibleCardsChanged`, from
          an `IntersectionObserver` rooted at the track; without the API every
          card counts as visible. Cards that leave the list are reported gone
          at once.
        - `DashboardPortalLiveEpgPresenter` (component-provided) unions the
          visible keys of both rails with the pinned hero keys and calls
          `DashboardPortalLiveEpgService.sync()` with exactly those entries —
          on every change, on each tick of the shared live-EPG clock, and on
          a display-offset change.
          It is reached through `DashboardLiveEpgPresenter`, which derives the
          portal rows itself from the enabled rails and pins the hero's live
          candidates, so the page component only forwards what a rail can see. The queue lives in
          the root service, so leaving the dashboard hands the wanted set back
          (`sync([])` on destroy); otherwise the queue would keep asking for
          cards on a page that is gone.
        - `DashboardPortalLiveEpgService` (root) owns the queue: at most two
          requests in flight, 200 ms between starts (the numbers
          `EpgQueueService` proved against real panels), one card per request,
          each answer published the moment it lands in `programs`, so the page
          never waits and a slow portal delays no other card. Only wanted keys
          are dequeued, so a card scrolled past before its turn is never
          requested. A programme lives 60 s; a programme that ended is asked
          again, but not within 30 s of the last answer (a portal may keep
          returning the stale row). An answer with **no** programme lives only
          30 s, because the resolver reports a failed portal and a guide-less
          channel identically (it files per-channel failures as `null`), so
          there is no failure cooldown to keep and the short TTL is what lets
          an outage recover on the next tick.
        - Every answer is "at the provider clock" and against one XMLTV source
          set. A request captures both the display offset and
          `EpgSourceSettingsService.revision()` — the same fence
          `EpgService.guard()` uses — and a completion whose either fact moved
          is discarded and requeued instead of published. That requeue has to
          happen in the completion: while the key is in flight the retire pass
          cannot queue a replacement, and without it the pre-change answer
          would be trusted for a full TTL (the repo's late-result
          invalidation contract).
        - Desktop only in practice: the shared collection resolver is gated on
          the local XMLTV bridge (`supportsProgramLookup`) and answers nothing
          without it, so `sync()` returns immediately in the PWA rather than
          filing an empty answer for every card. Lifting that gate for portal
          lookups would change the collection pages too and is deliberately
          out of scope here.
        - `DashboardLiveEpgPresenter.enrich()` prefers the portal answer, falls
          back to the XMLTV title match when the portal said "nothing on air",
          and marks a card
          `nowPlayingState: 'pending'` only before its FIRST answer — the
          channel layout then shows a shimmer placeholder in the programme
          slot; a refresh keeps the previous answer on screen.
    4. `xtreamRecentlyAddedCards` — maps `xtreamRecentlyAddedItems()` to rail
       cards. Aggregates newly added VOD and series across *all* Xtream
       playlists via `DashboardDataService.reloadXtreamRecentlyAddedItems()`,
       which calls `getGlobalRecentlyAdded('all', limit, 'xtream')` with the
       DB-level `playlists.type = 'xtream'` filter. The rail is Electron-only
       (PWA returns `[]`) and auto-hides when empty, so users without Xtream
       playlists never see it. Cards carry the source name as their subtitle
       (`playlistDisplayLabel`) so users can tell where each item was added;
       the content kind is not repeated on every card. Driven by an
       effect that re-runs whenever the Xtream playlist count changes, but the
       first run waits for `globalFavoritesLoaded()` so the slower
       recently-added DB query does not block the live favorites rail on
       startup.
    5. `recommendationCards` / `trendingCards` — the two TMDB rails. Both
       need the TMDB opt-in AND the Electron DB worker that answers
       `DB_MATCH_TITLES` (each is hidden in the PWA), and both load after
       `globalFavoritesLoaded()` AND `continueWatchingSettled()`
       (`connectDashboardTmdbRails` in `rails/dashboard-tmdb-rails.ts`) so
       the batched title match never competes
       for the worker at startup: one match runs a ranked FTS query per
       title and a common single word holds the worker for seconds on a
       large catalog; issued before the playback positions, it queued them
       behind it and kept the Continue Watching and hero skeletons up for
       as long as it ran (measured 14 s warm and 97 s cold on a 3.9M-title
       library). `recommendationCards` is seeded from
       recently watched movies/series and only shows titles present in an
       imported library, hiding itself below five matched cards; its rail
       label names the seed ("Because you watched X") when exactly one
       seed contributed. `trendingCards` shows TMDB's weekly trending and
       falls back to a prefilled global search for unmatched titles.
       Contracts: `docs/architecture/tmdb-metadata-enrichment.md`
       ("Dashboard Integration").
    6. `sourceCards` — maps `recentPlaylists()` to rail cards. `recentPlaylists()`
       ranks M3U, Xtream, and Stalker sources by their latest recent activity
       from `globalRecentItems()`, then falls back to playlist
       `updateDate` / `importDate` for sources that have never been used.
3. `DashboardDataService` is passive on construction. The dashboard feature
   owns the initial reloads for recent items, favorites, and Xtream recently
   added rows on page entry.
4. No dashboard-local `Layout` state, no localStorage keys, no migrations.
   Per-rail visibility is the one persisted preference, and it lives in the
   global settings store (`Settings.dashboardRails`), not in a
   dashboard-owned layout blob.
5. Navigation state + deep-link targets come from the existing
   `getRecentItemLink()` / `getGlobalFavoriteLink()` / `getPlaylistLink()`
   helpers on `DashboardDataService` and reuse the workspace navigation
   helpers in `@iptvnator/portal/shared/util`.
6. Xtream VOD and series detail pages opportunistically backfill
   `content.backdrop_url` when metadata exposes a backdrop, but that write
   must not refresh recently viewed ordering by itself.
7. The dashboard feature triggers a fresh reload of DB-backed recent/favorite
   rows on dashboard entry so newly backfilled backdrop data is visible as soon
   as the user returns from a detail page.
8. Playback-position reloads are keyed by the VOD/series recent set and should
   call `reloadPlaybackPositions()` through `untracked()` so live-only recent
   changes do not trigger unnecessary IPC round-trips.
9. Electron M3U dashboard favorites should use
   `PlaylistsService.getM3uFavoriteChannels()` first. That method checks the
   SQLite playlist migration flag and then calls
   `dbGetAppPlaylistFavoriteChannels(playlistId)`, letting the DB worker return
   only matched favorite channels instead of sending the full playlist payload
   back to the renderer. If the bridge method is missing or migration is
   incomplete, the dashboard falls back to the full playlist read.
10. Electron playlist summary loads should use
    `dbGetAppPlaylistMetas()` through `PlaylistsService.getAllPlaylists()`.
    This keeps dashboard/source/sidebar startup on a metadata-only SQLite path
    and avoids parsing full M3U `payload` blobs for surfaces that only need
    playlist title, type, counts, favorites, recent activity, and source
    connection fields. Workflows that need channel payloads still call
    `getPlaylistById()`.

## Streaming Platform Pages

TiagoTV's platform pages (`/workspace/platforms/:platformId`,
`lib/platforms/`) gather a platform's ES and EN Xtream VOD and series
categories (`PlatformsCatalogService`):

1. One card per show. The provider files a show once per language, under each
   language's name ("MUERTOS S.L." / "DEATH INC."), and sometimes in two
   categories. `mergePlatformTitles` (`platform-versions.ts`) joins entries
   of one kind that share the list's TMDB id (`tmdb` or `tmdb_id`), else the
   same normalized name with agreeing years (a missing year agrees, one year
   apart is tolerated), else the same poster (a TMDB image by its file name,
   whatever its size). A poster shared by more than six entries is a
   placeholder and joins nothing; entries whose TMDB ids or years disagree are
   never joined, not even through a third one. The card shows the Spanish
   version (its id, name and category; the other versions fill in a missing
   poster, rating, synopsis or backdrop), carries every version in
   `versions`, the union of their genres and the newest `added`, and labels
   its languages ("ES · EN"). A card and the hero's Play open the Spanish
   version's page; on the hero each language is a button of its own that
   opens that version's page.
2. The hero recommends six well-rated recent titles with artwork, movies and
   series in turn (`pickRecommendations`), drawn by the local day's seed
   (`daySeed`): different picks from one day to the next, the same all day.
   The page takes the seed once, so nothing reshuffles while it is open.
3. Rows (`buildPlatformRows`): what is new (by date, the newest 30), Netflix's
   Top 10 (the best rated with a poster among the newest 150), movies, series,
   then up to ten genres, the largest first. The hero's titles are left out of
   the new and Top 10 rows; a title takes two places on the page at most (the
   hero counts as one); every unranked row shows the titles the page has not
   shown yet first. Movies, series and genres go by rating, each title moved
   by up to two points by the row's own draw of the day, so the rows open on
   different titles. A genre row holds only titles of its genre and needs six
   not shown above it. A row shows 40 titles; "See all" opens its whole list
   (`PlatformRow.all`) as a history entry of its own (`?row=<id>`, pushed;
   the `row` input binds it): Back (the header's, the mouse's, Cmd+[ or the
   list's ‹) closes it through `WorkspaceBackNavigationService.back()`,
   whose parent is the platform's overview when the list opened the
   session, and a title opened from it comes back to it. The page keeps
   each view's scroll per navigation, as the shell does for pages
   (`followViewScroll`): the shell restores only a page come back to, not a
   query change on the same page.
4. Rows are laid out as each platform's own app lays them out (2025–26),
   from `platformDesign` (`platform-design.ts`): the tile shape (Apple TV's
   and Disney+'s posters, the others' 16:9), rows drawn with the other shape
   (`otherTileRows`), one larger featured row (`featuredRow`: Prime Video's
   poster "super carousel", Apple TV's and Hulu's large 16:9 tiles), names on
   the artwork or under it, and facts that open on a tile (`tileInfo`).
   `tileDress` turns that into each row's `TileDress`. A row's tiles share
   out its width (`--across-*` per look, container units), the fraction left
   over showing the next tile cut by the edge; a tile never shrinks under
   `--row-min` and stops growing past the rows' 1800px limit (`--row-width`),
   so a very wide window shows more tiles, not 600px ones. A row's sideways
   scroll comes back with Back and Forward (`libRememberScroll`). The facts (rating, kind, year, genre, synopsis) come from
   the list already loaded: a tile fetches nothing. They open after a short
   rest of the pointer (`--card-info-delay`) or at once on keyboard focus,
   and reduced motion drops their slide.
5. The billboard (`platform-billboard.component.scss`; Netflix, HBO Max and
   Apple TV) runs up under the top bar and places its text from its foot.
   At every width its text keeps the bar's room above it
   (`padding-top: calc(var(--tv-topbar-h) + 12px)`) and the billboard grows
   instead (`min-height: var(--bb-height)`), so no line sits under the bar
   or the window's buttons on a narrow or short window. `--bb-height`
   follows the width and, on a very wide window, keeps growing to 900px
   (`clamp(640px, 30vw, 900px)` as its top) rather than turn the artwork
   into a strip.

## By-Country Page (TiagoTV)

"En vivo" (`/workspace/countries`, `lib/countries/`; the top bar's En vivo
tab) is a TV: the live player fills the page, up behind the transparent top
bar (`margin-top: calc(-1 * var(--tv-topbar-h))`, the scroller's full
height, its top corners rounded with `--tv-window-radius`), with the
country's button top right and an overlay at its foot. Nothing scrolls, at
any height: the page has no pixel floor (a 900×600 window at 125 % is
480px tall). `/workspace/countries/:countryId` opens the page on that country (`ie`
opens the United Kingdom); another country's route while the page is open
switches to it.

1. **Data.** `CountriesCatalogService` builds on `SportsCatalogService`'s live
   catalog (the stored copy, its event categories kept fresh while the page is
   open): it downloads no line-up of its own. Only categories the language
   filter keeps (`isSpanishOrEnglishCategory`) count: Argentina (|LAT| groups
   naming it), Spain, the United Kingdom with Ireland's groups folded in, the
   United States. Adult streams and empty slots are left out
   (`country-slots.ts`): "No Event" slots, ended matches, a broadcast window
   that closed, and in a category of slots (PPV, events, a league's games) a
   numbered slot that names no event ("LALIGA+ PPV 3"). The clock retires
   finished event feeds as the sports views do (`longestEvent`,
   `match-clock.ts`, plus half an hour): a "Next | date | time" match past
   its kick-off by more than its competition's longest match, a "Live" the
   panel named (`added`) that long ago, a timeless "Next" unchanged for two
   days, a US pay-per-view game six hours after its Eastern time, and in a
   category of slots a numbered slot still named after an event a week on
   ("LIVE EVENT 26 - … Coachella 2026").
2. **Rows, chips and cards.** `buildCountryRows` still groups a country's
   channels: copies of a channel share one channel (quality badges, country
   codes, capitals tidied: `country-channels.ts`, `country-titles.ts`); a
   channel listed in several categories shows once, in its first row, with
   every copy. Kinds run main channels, sports, live events, news, movies and
   series, kids, documentaries, music, the rest, other versions (4K, SD, +1)
   (`country-genres.ts`); a country's main groups are split by channel name
   into those kinds, small categories join their kind's row, and the main
   row opens on the country's flagship channels
   (`CountryDefinition.leading`). The rows are not drawn as rows: they are
   the data of the overlay's category chips (`country-tv-categories.ts`): All,
   then one chip per kind the country has, with its channel count, in the
   order sports, events, main ("Generalistas"), news, movies and series, kids,
   documentaries, music, others, other versions. All opens on the main
   channels (La 1, BBC One, CBS…), then runs through the other kinds in the
   chips' order (`ALL_ORDER`). A new country starts on All. The chip picked
   stays on the history entry with its country (`countries-category`, see
   [Redesigned pages](#redesigned-pages-shared-rules-tiagotv)): Back to the
   page returns to it.
3. **Overlay.** The channel's name (32px) and what it shows now, the
   controls (play/pause, sound, Open in Live TV, full screen), the
   programme's 3px progress, the chips and the channels in glass cards
   (196px). A card shows the channel's logo (a failing logo tries the next,
   then the name in Bebas on a plate tinted per channel), its name, what it
   shows now and how far in when the guide says. The playing card says
   "REPRODUCIENDO"; a card showing football now has a red "FÚTBOL" tag
   (`country-tv-football.ts`): the sports catalog's live football matches,
   on their event channel or on their competition's channels ("DAZN LaLiga"),
   or a football programme in a guide already loaded. Unknown stays
   unknown: no tag, and the row's name instead of a programme. A channel's
   other feeds ("UHD", "HD") sit beside the controls. A channel starts on
   its best copy or, with Settings → Playback → Fluidez on "Más estable"
   (the default), on its HD copy before a UHD one (`startingCopy`); a
   remembered channel plays the copy watched, a chip the copy picked. The
   row renders only the cards in and near its view (`country-tv-window.ts`;
   "All" in the United States is over 1,500 channels) and is one tab stop (`role="toolbar"`):
   arrows, Page Up/Down, Home and End move along it, Enter plays.

   **Short windows** (`max-height: 700px`, a 900×600 window from 110 %):
   the veil drops from 140px to 64px (`--overlay-veil`), the rows tighten,
   the chips take one line scrolled sideways at any width (they wrap
   otherwise; one line on phones too), the cards are 156px and the name
   28px. The country button sits 20px under the bar (12px on a short
   window) but never closer than 8px above the overlay's controls
   (`top: max(bar + 4px, min(…, 100% - --live-overlay-content - 48px))`),
   so it cannot cover them.
4. **Country button.** A 40px glass button with the flag and the country's
   name; its menu (Spain, Argentina, the United States, the United Kingdom)
   gives each country's channel count. Choosing one closes it and plays that
   country's last channel watched, else its first (`countrySelection`).
5. **Quiet overlay** (`OverlayIdle`). While a channel's picture moves (its
   video said `playing`), the overlay slides away after four quiet seconds
   (a transform: fading it would stop its glass reading the picture) and
   the country button fades; a mouse move, a key, a press or keyboard focus
   brings them back, and the pointer hides while they are away. They stay
   while nothing plays, while keyboard focus or the pointer is on them, and
   while the menu is open. A click on the picture sends them away or brings
   them back; Esc closes the menu, else leaves full screen (where the window
   lets the page see Esc there), else sends them away (focus moves to the
   page). Space or K plays and pauses, M mutes, F goes full screen and back,
   an arrow brings focus to the playing card (`country-tv-keys.ts`); keys a
   focused control handles stay its own (the cards' arrows, Enter on a
   button; a letter or Space only in a field, so F on the full screen button
   just pressed still leaves and Space there pauses rather than pressing it
   again), and keys from a dialog or a field elsewhere are left alone.
6. **Playback** (`CountryTvPlayback`). A card plays in place; nothing
   navigates. The playback is built as the Xtream live view builds it:
   `XtreamUrlService` with the source's credentials and the stream format
   setting, the Auto TS fallback when the live view already learned the
   account's formats, the source's headers, and the live view's session key.
   `WebPlayerViewComponent` brings the one-connection rules, the live start
   guard and the mini-player hand-over. The page opens on the country chosen
   last (`tiagotv:countries-country`) on its last channel
   (`tiagotv:countries-channels`), else on the last channel watched
   (`tiagotv:countries-last-channel`), else on Argentina's first, and plays it
   unless the mini-player is playing another page's stream (then the white
   button offers Play); the mini-player's own channel (back from the live
   view, say) plays anyway, the page taking the stream over. With MPV or VLC
   as the player, Play ends the mini-player and launches it, and nothing
   plays on opening. A channel joins Recently viewed once it has
   played (`PlaybackHistoryGate`); a relock that withholds its category stops
   it. "Open in Live TV" opens the channel in the Xtream live view without a
   mini-player hand-over.
7. **Controls** (`CountryTvControls`). The player's own controls bar is
   hidden on the page, its picture takes no clicks and its shortcuts are
   suspended (`data-player-shortcuts-suspended` on the page): the overlay and
   the page's keys drive it. Play/pause and mute go to the player's
   controller as its own K and M (the suspension lifted for that one key),
   else straight to its `<video>`, whose events give the overlay its state;
   Embedded MPV has no `<video>` and counts as playing once mounted. Full
   screen takes the whole page, overlay included. The player's diagnostic
   (what failed, Retry, Copy URL, Details, the external players) sits
   between the country button and the overlay's controls: it is bounded by
   `--live-overlay-content` (the overlay without its veil, which the
   opaque panel covers), not by the overlay's whole height. While it
   shows, on a window up to 900px tall the overlay keeps only its cards
   (to pick another channel) and drops its veil to 24px, and up to 560px
   tall the cards go too (`:host-context(.live:has(app-playback-diagnostic-panel))`):
   at 900×600 and 83 % the panel had 28px, it now has about 320px, its
   message and buttons all in view. The resting logo or name is centred
   between the bar and the overlay's controls too (`.rest` padding from
   `--live-overlay-content`), not 34 % of the width up.

   Native-view Embedded MPV (`CountryTvControls.nativeSurface`: the engine
   without its frame-copy canvas) paints a platform view over the window,
   above every page element (see [Embedded MPV](./embedded-mpv-native.md#bounds-compositing-strategy)),
   so the page adapts. Its full screen is the player's own, on its
   `app-web-player-view` as the live view's controls take it: the picture
   fills the screen over its own dock (the exit button, shown by a move),
   which takes the pointer there; nothing of the page shows. Elsewhere the
   page keeps its dock hidden, and while the overlay shows the picture keeps
   clear of the top bar, the country button and the overlay's controls
   (`live--native`, `--live-player-inset` from the overlay's
   `--live-overlay-content`); quiet, it takes the page. The country menu
   moves it away while open (`acquireExternalModalSurface`). Before, the
   picture covered the bar and the overlay, and the page's full screen left
   it on the page with only the cards' foot showing and no way out.
8. **Guide.** Now and next come the way the live view loads a channel's guide
   (`StreamResolverService.loadEpgItems`: uploaded XMLTV, the manual mapping,
   then the provider's guide for that channel), asked for once a channel has
   stayed playing for 0.9 s and at most every ten minutes per channel, and
   only where the app reads guides. The cards reuse the guides already
   loaded (`CountryTvGuide.nowOn`); the page asks for no other channel's.

## Series and Movies Catalog (TiagoTV)

Series (`/workspace/series`) and Películas (`/workspace/movies`) are one page,
`CatalogPageComponent` (`lib/catalog/`), told its kind by the route's
`data.kind` (`'series'` or `'movie'`). It shows every streaming platform's
titles of that kind in one catalog, with no filters and no search of its own.

1. **Data** (`CatalogService`). The titles come from the catalog the app
   already stored (`StoredVodCatalog`): SQLite through the DB worker in
   Electron once that kind's import completed, the data source's session
   cache in the browser build once a view loaded it. Reading it asks the
   provider nothing. Only the platforms' ES/EN categories count
   (`buildPlatformShelves`). A stored read is kept ten minutes, and again
   until the parental lock changes.
   - **First run in Electron** (`CatalogImport`). Nothing is stored until
     the kind is imported, and the redesign opens no Xtream Movies/Series
     view that would import it, so the catalog runs the app's own import
     of that one kind: the data source's `getCategories` and `getContent`
     (`get_series_categories` + `get_series`, or the VOD pair — the whole
     catalog in two requests), saved by the DB worker, then recorded as the
     Xtream store does (`completed`; or `failed`, its partial rows cleared,
     after one retry 20 s later). The page shows "Preparando tu catálogo…"
     (`WORKSPACE.CATALOG.PREPARING`, `CatalogService.preparing`) and reads
     the stored copy when the import resolves. It never runs beside other
     work on the source: while `SourceActivityService` reports it busy (the
     Xtream store's own import, a refresh, a removal) it polls every 2 s
     (up to 10 min) and then reads what that flow stored; it holds the
     source busy itself while importing. The app writes no `importing`
     status, so a running import is known from that activity, not from
     `getXtreamImportStatus`. It leaves a `cancelled` import cancelled, a
     pending backup restore to the Xtream store's flow (which replays it),
     and does not run while the parental lock withholds every row. A kind
     whose import failed uses the platforms' lists for the rest of the
     session and is imported again next launch. (The live sections' first
     run differs: `StoredLiveCatalog.download` takes the whole line-up in
     two requests and holds it in memory for the session, without storing
     it; it never runs in this queue.)
   - **Platforms' lists** (`CatalogPlatformLists`): the browser build, or
     a failed import. Each platform's categories of the kind, one request
     at a time and with the platforms taking turns (every platform's first
     category, then each one's second…; `takeTurns`), failed ones once more
     5 s after the pass; each kept 30 minutes. A platform whose page already
     loaded its lists (`PlatformsCatalogService.titlesOf`) is not asked
     again; these per-category lists do not feed the platform pages. The
     page stays loading until three platforms answered or failed (all, when
     fewer carry the kind: `MIN_ANSWERED_PLATFORMS`), so one platform's
     titles never pass for the whole catalog; it fails only when no title
     came and a platform's requests all failed.
   - Imports and category requests share one queue (`CatalogRequests`):
     Series, Películas and the Home's sections never ask the provider at
     once, and a second kind's import waits for the first.
2. **One title per show** (`aggregateCatalog`). `mergePlatformTitles` joins
   a show's language versions and its copies on other platforms. The card
   shows the Spanish version and that version's platform logo; `platforms`
   lists every platform that has a version. Newest first.
3. **Genres.** A title takes the genres its list names (`genre`, genre
   categories in `category_ids`). SQLite rows store no genres, so a stored
   title also takes them from a same-named title in the source's genre
   categories ("|ES| ✪ COMEDIA") or from the platform pages' loaded lists.
   One row per genre with at least two titles, in a fixed order (Action,
   Comedy, Drama, Thriller, Crime, Sci-fi, Horror…), showing its newest 40
   titles. When no genre reaches two titles, the page shows one row per
   platform instead.
4. **Hero** (README 06). It rises behind the top bar. The featured title
   shows its logo, name, kind · year · genres · running time or seasons,
   Reproducir (the title's Xtream page, playing: the movie from where it
   was left, a series the episode its quick start names; a detail play
   request) and Más info (the page). Under it
   comes "Novedades": the ten newest titles with artwork, the platforms
   taking turns (`pickNewReleases`). Picking one features it and the page
   does not navigate. The first title featured stays until another is
   picked (`featuredTitle` follows it to another of its versions), though
   "Novedades" reshuffles while the platforms' lists arrive. The featured
   title's own page (`get_vod_info` / `get_series_info`) is fetched once
   per title, after it has stayed
   featured 0.4 s, for its backdrop and length. Without a backdrop the hero
   shows the poster at its right over the platform's colour. It is
   `clamp(420px, 100vh - 340px, clamp(780px, 32vw, 1000px))` tall at
   least: on a short window (`max-height: 700px`) its spacer, gaps and
   title (sized from the height too, two lines) tighten so "Novedades"
   still peeks above the fold at 100–125 %, and on a very wide one it
   grows with the width (to 1000px) instead of stopping at 780px. The
   section's name is 22px/600, 20px under the bar, both in the hero and
   while the page loads or fails (it no longer jumps from 32px).
5. **Rendering.** A genre row renders its posters once it comes within
   900px of the scroller, and posters load lazily. Each row is one tab stop
   (arrows, Home and End move along it) with hover chevrons. Rows bleed
   through the page's gutter (`--tv-page-x`), `--tv-section-gap` apart (as
   the hero is from the first). Each row's sideways scroll, and
   "Novedades"', comes back with Back and Forward (`CatalogStripComponent`
   `memoryKey`). Loading, failure (with Retry: `CatalogService.load` again),
   no source and no titles are `PageStateComponent`s.

## Sports Hub and Competition Pages (TiagoTV)

Deportes (`/workspace/sports`, `SportsHubPageComponent`) and a competition's
page (`/workspace/sports/:sectionId`, `SportSectionPageComponent`) live in
`lib/sports/`. Both read `SportsCatalogService` (the stored live catalog, its
event categories reloaded one at a time) and ask the provider for nothing
else but the playing channel and its guide.

1. **League cards** (`ui/sports-rail.*`, the Home's row too). The order is
   `SPORTS_ROW_ORDER` (README 01/02); Motor and the Eredivisie keep their
   sections and pages without a card. Five and a half cards in view (up to
   the rows' 1800px limit; then about 320px cards and more of them), the
   player's head over the card in the row's top padding (a tenth of a card's
   height, never under 44px). The glass pill counts the section's matches on
   now (`SportsBoardService.liveCounts`).
2. **Hub.** The day picker (yesterday … three days ahead) lists the matches
   whose kick-off falls on that local day (`matchesOnDay`; the panel announces
   kick-offs hours ahead and lists no results, so past and far days are mostly
   empty). "Tus equipos" are `MY_TEAMS` (`my-teams.ts`, the one list the sports
   views bold): each pill shows "En vivo" or its next kick-off. "En vivo ahora"
   shows today's matches on now; "Más tarde" the day's others, in the same
   60px rows as the Home's list; its cards are as many as fit at 420px or
   more (`repeat(auto-fill, minmax(min(100%, 420px), 1fr))`), so a wide
   window shows more, not 1000px cards, and a click anywhere on a card does
   what its "Ver en {canal}" pill does. The day picked stays on the history
   entry (`sports-day`): Back returns to "Mañana", a new visit opens on
   today. The title sits as high as other pages' h1: the day picker,
   centred on it, takes no more of the line (`margin-block: -4px`). Loading
   and failure (with Retry) are `PageStateComponent`s. The provider names
   no score or minute, so a card shows "vs" and "En vivo". No match reminder exists in the app, so the
   rows carry Play, not a bell. A match opens its competition's page playing
   its feed (`SportsBoardService.openMatch`, the channel in the navigation
   state, `playRequest`).
3. **Competition page.** A full-height stage (`ui/sport-stage.*`) rises behind
   the top bar, as tall as the scroller shows (`fitScroller`; no pixel floor,
   so a short window does not scroll its controls away), and plays the first signal, or
   the one the way in asked for, through `SportTvPlayback` (built like "En
   vivo"'s: `XtreamUrlService`, MPEG-TS by default, Auto TS, the mini-player
   hand-over, one stream at a time). A channel the way in asked for plays even
   over another page's mini-player, and so does the mini-player's own channel;
   back from the mini-player the page opens on the channel it plays, not on
   the request its way back replays (`dockedChannel`). A competition with no
   channel clears the stage, so a reused page never keeps the previous
   competition's stream; "Playing" shows on the active signal only while the
   stage plays. Its controls and keys are "En vivo"'s
   (`CountryTvControls`), Esc and native-view Embedded MPV's own full screen
   included; that picture keeps clear of the top bar, the competition's pill
   and the overlay's controls (`stage--native`, `--sport-overlay-content`),
   and so does the player's diagnostic out of full screen (on a phone the
   bar takes two rows). The diagnostic is bounded by
   `--sport-overlay-content` (the overlay without its veil); while it
   shows, a window up to 900px tall keeps only the signals in the overlay
   and one up to 560px drops them too, as on "En vivo". A short window
   (`max-height: 700px`) gets the lower veil (`--stage-veil` 64px) and
   tighter rows, and the competition's pill stays 8px clear of the
   controls. The resting logo and Play are centred above the overlay's
   controls. In full screen the overlay fades after 2 s; a
   move or any key brings it back.
   The signal row (`signal-cards.ts`) lists the live
   matches' own feeds first, then every numbered feed of the section's
   channel families, broadcasters first and pay-per-view passes last. Below:
   the first match, the others (84px rows) and the standings.
   A match in focus (the one the way in or a click asked for while the
   stage plays one of its feeds, else the match a name-carrying feed on the
   stage belongs to: `focusedMatch`) turns the row into "Señales de este
   partido" when it has more than one signal; "Todos los canales" brings the
   section's row back. Its signals are `SportMatch.feeds` (`match-feeds.ts`,
   `feed-languages.ts`): every event slot naming it in any language, the
   channels that name it without being slots ("UEFA | 05 - PSG vs Barcelona
   21:00 pm", `parseNamedMatch`; not a replay's, nor a listing dated another
   day), and its `via` channels with their two best copies. Order:
   Argentina's and Spain's, then the rest of Latin America's, the English
   ones, then the others; in each language the name-carrying feeds before
   the `via` ones, HD before 4K, unknown and SD; one stream once. The
   match's default channel is unchanged (a kept feed, else its first
   `via`). Each card carries its language as a chip (a bundled flag where
   there is one; the labels are `WORKSPACE.SPORTS.FEED_LANGUAGES.*`). When
   the playing signal fails (the web engines' `playbackFailed`, Embedded
   MPV's `playbackLost` once its reloads ran out), `SportFeedFallback`
   plays the next one in that order on its own, once per match and never
   after the viewer's own pick, and says so; otherwise it offers "Probar
   otra señal" naming the next one (language · channel), skipping the
   signals that failed ("Sin señal" on their cards). While a match is on,
   the kept numbered listings its competition claims (`|UK| ✪ UEFA
   CHAMPIONS LEAGUE`) are reloaded with the event categories
   (`listingCategoryIds`), so their names are tonight's.
4. **Standings** (`league-tables.ts`, `league-table-sources.ts`). ESPN's
   public site API (`<slug>/standings`: esp.1, eng.1, arg.1, uefa.champions,
   uefa.europa, conmebol.libertadores, usa.1, esp.2, ita.1, ger.1, fra.1,
   ned.1) gives the whole table and its zones, but no form. When ESPN fails or
   has no table, TheSportsDB's `lookuptable.php` (its free key: the top five
   rows, with form) stands in. Each API has one throttled client
   (`SportsApiClient`; TheSportsDB one request every 3 s, shared with the
   crests). Answers are kept in local storage for three hours (an empty answer
   six); a fallback given while ESPN failed is kept for the session only.
   Zones come from each row's note (Champions, the other continental cups,
   promotion or direct qualification, playoffs, relegation). A table in
   groups (Argentina, MLS, the Libertadores) opens on the group holding a
   followed team, with a small switch to the others (`LeagueTable.groups`;
   the cache's v3 key keeps every group). ESPN refuses headless Chromium's
   user agent (403), not a desktop one. "Resto del mundo", Tenis, Motor and
   Básquet have no table and run their matches across the page.

## Search Page (TiagoTV)

`/workspace/search` (`lib/search/`) matches a term word by word
(`matchRank`, accents, case and apostrophes folded): the phrase as typed
ranks first (the start, then a word start, then anywhere), then a text
holding every word in any order; spacing aside, "dazn laliga" finds
"DAZN la LIGA". Teams, channels and titles all use it. The catalog's own
search matches one substring, so a term of several words asks it for its
longest word (`catalogQuery`) and `toTitleHits` keeps the answers holding
every word; nothing more is asked of the provider. A team row opens its
competition's page playing the team's match when it is on today
(`teamMatchToday`, `SportsBoardService.openMatch`), else the page as it
opens.

The page reads from the gutter and stops at 1200px of content (a wide
window's rows no longer run 3000px). The scope chips are the pages' chip
("En vivo"'s), the group titles the pages' 20px/600 section titles
`--tv-title-gap` above their card and `--tv-section-gap` apart, and
"no results" a boxed `PageStateComponent`. The scope picked stays on the
history entry (`search-scope`) and through the term's own `replaceUrl`
writes to `q` (they pass `pageMemoryState()` as their `state`).

## Redesigned Pages' Shared Rules (TiagoTV)

Inicio, Deportes, a competition's page, En vivo, Series, Películas, Buscar
and the Home's platforms row share these (`lib/ui-state/`):

1. **Rhythm.** Sections `--tv-section-gap` (44px) apart on every page (the
   catalog's 48/56px and the competition page's 56/48px are gone), a
   section title `--tv-title-gap` (20px) above its content, the page's foot
   `--tv-page-bottom`.
2. **States** (`PageStateComponent`, `lib-page-state`). One look for empty,
   error and loading messages: a 16px/600 title, a `--tv-meta` line under
   it and, where the page can load again, a white 36px "Reintentar" pill
   (`retryable`, `(retry)`); `boxed` draws the dashed box where it stands
   in for a section's content. A one-string message splits at its first
   sentence (`splitStateMessage`: "No se pudo cargar el catálogo" over
   "Probá de nuevo en un rato."); `detail` gives the line apart. Retry
   reloads the page's data: `SportsCatalogService.load`, `CatalogService.load`,
   `CountriesCatalogService.retry`.
3. **Hover** (`_page-ui.scss`). A card lifts 4px and takes a 2px white
   ring (`$card-lift`, `$card-ring`; a card an image fills draws the ring as
   a layer over it, `ring-layer`/`ring-shown`): platform, sports, Top 10,
   series and channel cards, catalog posters and "Novedades", En vivo's
   cards, a competition's signals and Deportes' match cards. A list's row
   (Home events, Deportes' later matches, a competition's match rows,
   search results, standings) takes the same faint wash (`$row-wash`).
4. **Chips.** One chip, "En vivo"'s (`chip`, `chip-hover`, `chip-on`): the
   category chips, the search scopes and the recent searches. Action
   buttons are 44px pills ("Ver en {canal}" included).
5. **Rows of tiles.** A row that shares its width out among a number of
   tiles stops growing them past 1800px (`$row-width-max`): the Home's
   platforms (200px from 6.5 across), sports (5.5), Top 10 (4.6) and last
   channels (4.5) and the platform pages' rows scale alike, and a wider
   window shows more tiles.
6. **History memory** (`page-memory.ts`). A page's own choices are kept on
   the browser's history entry (`history.replaceState`, merged with the
   router's keys, never a new entry): Deportes' day, En vivo's chip,
   Buscar's scope and every sideways row's scroll
   (`RememberScrollDirective`, `[libRememberScroll]="key"`: saved once the
   row rests, restored when the entry comes back, retrying up to 1.5 s
   while the row fills in, a wheel or press winning). The router keeps an
   entry's other state keys when Back or Forward returns to it, so the page
   reads them as it opens; a new visit starts fresh.

## Detail Play Requests

A "play" button that lands on an Xtream details page (the Home hero's
Continue on a movie, "Empezar T1·E1", Series / Películas' Reproducir) adds
`DETAIL_PLAY_REQUEST_STATE_KEY` to the navigation state
(`withDetailPlayRequest`, `@iptvnator/portal/shared/util`): a mode
(`resume`, `first-episode`) and the title's id. The page reads it once as
it is created, from the navigation or, for a collection's inline detail,
the history entry (`playOnDetailRequest`), and starts playing once it shows
that title and its saved positions are in: a movie through its primary
action (resume, else from the start), a series the first episode or the
episode its quick start names (the first again once watched through). The
request then leaves the history entry, so Back or Forward onto it does not
play again.

The hero's Continue on a series carries its episode the other way:
`seriesResume` inside the global-recent inline-detail state
(`OPEN_COLLECTION_DETAIL_STATE_KEY`). `createCollectionDetailState` takes it
off the entry as the detail opens (`clearCollectionDetailSeriesResume`),
keeping the detail and the in-memory target the open detail resumes from, so
Back, Forward or a reload onto the entry show the series without starting
the episode again (each one used to restart it with a new VOD request and
end the mini-player). The other ways in that play on arrival already leave
their entry once acted on (`openXtreamLiveItemId`, `openLiveCollectionItem`,
`openStalkerLiveItemId`, `openStalkerItem`); a league page's
`tiagotvSportsPlay` stays, as live pages play on opening anyway and the
mini-player's way back reads it.

## Empty State

The welcome state is rendered via the existing
`EmptyStateComponent` (`type="welcome-dashboard"`) from
`libs/playlist/shared/ui`:

1. Illustration + headline + description from the existing M3U welcome
   strings (`HOME.PLAYLISTS.WELCOME_*`).
2. Primary button emits `addPlaylistClicked`. The dashboard page wires this
   to `WORKSPACE_SHELL_ACTIONS.openAddPlaylistDialog()`.
3. Feature chips (M3U / Xtream / Stalker) are provided by the component.

## UX Rules

1. Rails represent content the user is likely to resume, not provider
   internals. Never surface raw API objects.
2. Each rail must auto-hide when its data source is empty.
3. Image assets must degrade to a typed icon fallback — never show broken
   images or empty tiles.
4. The page must never show "No widgets" style text. If there is no content
   and no playlists, render the welcome state; otherwise render whatever
   rails have data.
5. Navigation from a rail card must deep-link into the appropriate workspace
   route without switching the active playlist in the header switcher.
6. Xtream and Stalker series hero/Continue Watching clicks with a saved episode
   position must resume that exact episode while preserving the
   collection-owned detail and Back behavior. Do not apply autoplay to
   ordinary collection-grid clicks; only a button that says play carries a
   detail play request.
7. `Recently Used Sources` reflects recent source usage across all provider
   types, not just recent imports.
8. The live rail title key must match the rendered source: favorites use
   `WORKSPACE.DASHBOARD.LIVE_FAVORITES`; the recently-watched-live rail uses
   `WORKSPACE.DASHBOARD.RECENTLY_WATCHED_LIVE_TV`
   (`liveRailTitleKeyForSource` in `rails/dashboard-rail.utils.ts`).

## Adding Or Changing Rails

Current workflow:

1. Add a new `computed()` signal for the card list in
   `WorkspaceDashboardRailsComponent`, mapping your source data to
   `DashboardRailCard`.
2. Drop a `<lib-dashboard-rail>` in the template, gated by
   `@if (cards.length > 0)`.
3. If the data source is new, extend `DashboardDataService` rather than
   reaching into DB services directly from the component.
4. Provide a `seeAllLink` only if there is a dedicated "manage all" route
   for that content type.

## Deferred Work

Intentionally out of scope:

1. Customizable layout (drag/drop, resize, freeform reordering). The rail
   order stays curated and opinionated. (Per-rail show/hide toggles have
   since shipped via `Settings.dashboardRails` — see Summary.)
2. Freeform widget grid with collision management.
3. External data rails such as RSS, sports, or news adapters.
4. Per-user A/B variants of rail ordering.

## Source subscription expiry

Source cards show a passive subscription-expiry chip: amber within seven days,
error-toned once expired. Account details stay behind the Account info menu.
`DashboardSourceExpiryService` in `libs/workspace/dashboard/data-access` reads
Xtream expiry from cached `PortalStatusService.checkPortalStatusDetails()`
(`exp_date`). Stalker uses the persisted `stalkerAccountInfo` snapshot from the
playlist payload, not the metadata row; each source therefore needs one memoized
full-playlist read. The chip is not a separate account-refresh request.
The badge only changes at day boundaries, so the rails do not poll the clock:
`createSourceExpiryClock` arms one timer for the earliest boundary among the
known facts (`nextSourceExpiryChangeMs`), capped at an hour because timers do
not follow system sleep. It arms no timer while the page is hidden or the
sources rail is disabled, and re-reads the clock when the page becomes visible. It schedules from the real
time, so facts that arrive long after the last tick are not scheduled late.
Facts whose badge can no longer change arm no timer.
