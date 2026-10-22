# Workspace Shell

This document records the current workspace-first shell contract. It is the
stable replacement for the older UI refactor summary.

Related:

- [Workspace Dashboard](./workspace-dashboard.md)

## Summary

- `/workspace` is the primary app surface.
- `WorkspaceShellComponent` owns the persistent frame: the TiagoTV top bar
  (tabs, Back, Buscar, Ajustes, the source switcher), optional context panel,
  content outlet, and external playback footer. The redesigned pages scroll
  under the transparent bar (see [Shell Structure](#shell-structure)).
- Descendant workspace pages inherit `layout = 'workspace'` from the
  `/workspace` root route.
- Provider route trees now bootstrap through route-scoped session providers
  instead of nested provider shell components.

Core implementation:

1. `apps/web/src/app/app.routes.ts`
2. `libs/workspace/shell/feature/src/lib/workspace-shell/workspace-shell.component.ts`
3. `libs/workspace/shell/feature/src/lib/workspace-shell/workspace-shell.component.html`
4. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell.facade.ts`
5. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-route-state.service.ts`
6. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-search.service.ts`
7. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-search-sync.service.ts`
8. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-header.service.ts`
9. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-command-palette.service.ts`
10. `libs/workspace/shell/feature/src/lib/workspace-shell/services/workspace-shell-xtream-import.service.ts`
11. `libs/portal/shared/util/src/lib/navigation/portal-route.utils.ts`
12. `libs/portal/shared/util/src/lib/navigation/portal-rail-links.ts`
13. `libs/portal/shared/ui/src/lib/navigation/portal-rail-links.component.ts`

## Route Contract

Current workspace routes:

1. `/` -> `/workspace`; any unknown address (`**`, `/workspace/nope`
   included) -> `/workspace` too. The redirect is absolute: a relative `''`
   left the router on `/` with nothing routed, so the start-up screen
   stayed.
2. `/workspace` -> functional redirect `workspaceEntryRedirect`
   (`WorkspaceStartupPreferencesService.resolveInitialWorkspacePath()`;
   `/workspace/dashboard` by default, `/workspace/sources` when the dashboard
   is disabled, or the last restorable route under
   `StartupBehavior.RestoreLastView` — `dashboard` itself is guarded by
   `dashboardAccessGuard`)
3. `/workspace/dashboard`
4. `/workspace/sources`
5. `/workspace/playlists/:id/:view` (plus `favorites` and `recent` siblings)
6. `/workspace/global-favorites` (TiagoTV's Mi lista: its live channels
   are a row of cards first, `app-collection-channel-row` with the
   collection page's `channelRow`, then the movies and series under their
   type chips and Clear; a channel card plays on "En vivo", or in its own
   source's favourites for M3U and Stalker, and its red heart removes it —
   see [Workspace Dashboard](./workspace-dashboard.md#by-country-page-tiagotv))
7. `/workspace/global-recent`
8. `/workspace/search`
9. `/workspace/downloads`
10. `/workspace/settings/:section` (`/workspace/settings` redirects to
    `general`; the settings page's own rail (`SettingsRailComponent`) links
    each section page; sections:
    `sources` (TiagoTV: sources & accounts, shortcuts, quick parental
    lock), `general`, `playback`, `epg`, `dashboard`, `remote-control`, `tmdb`,
    `parental` — see [parental lock](parental-lock.md) — `backup`, `reset`,
    `about`)
11. `/workspace/xtreams/:id/...`
12. `/workspace/stalker/:id/...`
13. TiagoTV pages (`@iptvnator/workspace/dashboard/feature`, see
    [Workspace Dashboard](./workspace-dashboard.md)): `/workspace/sports`
    (the sports hub, the Deportes tab), `/workspace/sports/:sectionId` (a
    league; `knownSportSectionGuard` matches only a competition of
    `SPORT_SECTIONS`, and an unknown one redirects to the hub within the
    same navigation), `/workspace/series` and `/workspace/movies` (the aggregated
    catalog, route data `kind`), `/workspace/countries` and
    `/workspace/countries/:countryId` (En vivo) and
    `/workspace/platforms/:platformId`.

Compatibility redirect:

1. `/settings` -> `/workspace/settings`

The router resolves a cancelled history traversal as `computed`
(`withRouterConfig` in `apps/web/src/app/app.config.ts`): a guard that
refuses Back or Forward (Ajustes with unsaved edits) steps the browser back
to the page that stayed. Angular's default (`replace`) rewrote the entry
being left for into the current URL, so the page before was gone from
history (`app.config.spec.ts`).

Provider route integration:

1. Every routed view renders inside the workspace shell (the only top-level
   paths outside `/workspace` are redirects), so views keep no standalone
   layout branches: the top bar owns navigation, search, the source
   switcher and Back.
2. Xtream and Stalker parent routes attach route-scoped session providers that
   bootstrap the active playlist, sync provider section state, and clean up
   provider-local state when the route is destroyed.
3. Xtream route bootstrap is DB-first for already imported Electron playlists:
   if the requested section has persisted categories and content, the route
   hydrates from SQLite even when the portal status probe reports unavailable,
   expired, or inactive. Fresh/no-cache Xtream routes still use the status probe
   to block remote imports before the loading overlay starts.
4. Workspace routes no longer rely on nested provider shell components for
   hidden local chrome.

## Shell Structure

The shell is intentionally split into four persistent regions:

1. Top bar (`components/workspace-shell-top-bar/`, TiagoTV, the handoff's
   "barra superior"): a transparent 84 px band (`--tv-topbar-h`) over the
   top of the glass window. The band lets the pointer through
   (`pointer-events: none`); only its groups take clicks, and in Electron
   the band moves the window (`app-region: drag`, groups `no-drag`). A wheel
   over a group still scrolls the page below (the shell forwards it).
   Nothing a page draws may rest under the band, where the bar takes the
   clicks and Electron moves the window: pages start below it, and only
   artwork bleeds behind it. Overlays (menus, the source switcher's panel,
   selects, dialogs) and modal backdrops are `no-drag` (`.cdk-overlay-pane`,
   `.cdk-overlay-backdrop` in `apps/web/src/styles.scss`); the overlay
   container and popover hosts are not, because they span the window and
   would stop every page from moving it.
    1. Left: room for the macOS traffic lights (`has-traffic-lights` on the
       shell, `--traffic-lights-clear-x`; nothing in the browser): a spacer
       that ends at the clearance whatever the bar's padding and gap
       (`--topbar-pad-start`, `--topbar-lead-gap`), and a group that reaches
       it even with nothing after the lights, so the capsule never starts
       under them. Then Back
       on deep pages (see [Header Back](#header-back)), "‹ Deportes" back to
       the sports hub on a league page (`/workspace/sports/:sectionId`), and
       at phone width the context drawer toggle.
    2. Centre: the glass tab capsule, Inicio (`/workspace/dashboard`),
       Deportes (`/workspace/sports`), Series (`/workspace/series`),
       Películas (`/workspace/movies`), En vivo (`/workspace/countries`) and
       Mi lista (`/workspace/global-favorites`). `readWorkspaceTopBarPage()`
       (`workspace-top-bar-nav.ts`) reads the page from the URL. A tab's
       own page lights it; so does a portal section's list, whatever opened
       it (`live`, `itv`, `radio` En vivo, `vod` Películas, `series` Series,
       `favorites` and `recent` Mi lista: the mini-player's "Abrir" and Mi
       lista open channel lists). A platform page belongs to Inicio, a
       league page to Deportes. A deep page (`keepsTab`: a title,
       `/workspace/global-recent`, where the Home hero's "Continuar" opens
       a title) keeps the tab of a tab's page that opened it
       (`resolveWorkspaceTopBarTab()`, fed the page left and its tab);
       opened from another deep page or from nowhere (a reload, a deep
       link) its section decides, else the tab lit before. Buscar (also a
       portal's search) and Ajustes light their circle and no tab; Fuentes
       and Descargas light none. History Back and Forward light the tab
       their entry lit when it was left (`WorkspaceTopBarTabMemory`,
       `workspace-top-bar-tab-memory.ts`, keyed by the router's navigation
       id like the scroll memory), never the tab of the page just left. The
       lit tab clicked again closes a detail its page opened in place (see
       [Header Back](#header-back)), else scrolls its page back to the top
       (smoothly, unless reduced motion). On a league page Deportes goes up
       to the hub as "‹ Deportes" does, never a new hub entry that Back
       would bounce through into the league and its stream.
    3. Right: the page's own shortcut and the live channel list toggle
       (`WorkspaceHeaderContextService`, as round glass buttons), a
       downloads circle with the active count while downloads run, the
       parental lock toggle while the lock is on, Buscar, Ajustes
       (`/workspace/settings`) and the red profile circle, which is the
       source switcher (`app-playlist-switcher` dressed as the circle; ⌘P /
       Ctrl+P opens it; its popover manages, adds and switches sources).
       The popover's header also holds the permanent way into Downloads
       (`/workspace/downloads`), where
       `RuntimeCapabilitiesService.supportsDownloads` reports the download
       manager (Electron; the browser build has none).
    4. Buscar filters the page itself where the route searches in place
       (portal lists, sources, downloads, Mi lista, settings): it opens into
       a field in the bar bound to the shell search (Esc clears, then
       closes; an applied filter keeps it open). Elsewhere (the Home, the
       redesigned pages) it opens the search page, `/workspace/search`,
       which has its own field; on that page Buscar and find focus it.
       `Ctrl/Cmd+F` (Electron) does the same.
    5. Nothing in the bar overlaps at any width or zoom. Its grid
       (`minmax(min-content, 1fr) minmax(0, auto) minmax(min-content,
       1fr)`) never shrinks the side groups below what they hold; the
       capsule between them yields (`min-width: 0`, `overflow: hidden`) and
       its tabs scroll sideways in a track (`.topbar__tabs-track`) that
       fades out at an end where more tabs hide, with the lit tab scrolled
       into view, at every width. The bar measures what it holds
       (`readWorkspaceTopBarWidths()`, on resize, zoom, font load and each
       change of its contents) and picks a density
       (`resolveWorkspaceTopBarDensity()`, `workspace-top-bar-fit.ts`):
       the full spacing (tab padding 20 px, 32 px between the groups) on a
       window of at least 1180 CSS px where every tab shows; else compact
       (`is-compact`: 12 px tabs, 16 px gaps, 20 px trailing padding) where
       that fits; else two rows (`is-stacked`): the circles beside Back,
       then the capsule centred on a row of its own. At 760 px and below
       the bar always takes two rows, with narrower spacing and 40 px
       circles. The two-row bar is `--workspace-topbar-stacked-top + 104px`
       tall (108 px; the shell's `has-stacked-bar`, from the bar's
       `densityChange`). Buscar's open field keeps an honest least width
       (`--topbar-search-min`, 200 px) and the capsule scrolls beside it;
       the field alone never makes the bar take two rows unless the capsule
       would keep less than 160 px. Every measure is the same in each
       density, so a change of density never changes the answer.
    6. The page circles (the live list toggle, a page shortcut) draw the
       bar's own 19 px line glyphs (`workspaceTopBarLineIcon()`: `sidebar`,
       `grid`); a shortcut icon without one keeps its Material ligature at
       19 px.
    7. The capsule, circles and pills are dark glass: a ground
       (`--topbar-glass-ground`) under the sheen (`--tv-glass-bg`) and a
       dimmed backdrop (`--tv-glass-filter` plus `brightness(0.75)`), so the
       labels (`--tv-text-img-1`) and icons keep 4.5:1 over a white hero.
    8. The scrim (`.workspace-top-scrim`): while the page under the bar is
       scrolled (the shell's scroller, or a page's own full-height scroller
       such as a platform title page; `watchWorkspaceScrolled()`,
       `workspace-top-scrim.ts`), a dark gradient from the window's top edge
       to clear below the bar keeps row titles off the traffic lights and
       the capsule. At the top of a page it is gone, so heroes bleed behind
       the bar as designed. It is a plain gradient over the scroller, below
       the corners and the rim, never a mask on the scroller (see
       [Content surface corner](#content-surface-corner)), and never takes
       the pointer; framed pages, which start below the bar, have none.
2. Main body:
    1. Optional left context panel.
    2. Main router outlet content in the one vertical scroller,
       `main.workspace-content`, which draws no scrollbar. In server storage
       mode an offline banner with Retry takes the first row of
       `.workspace-content-frame`, above the scroller, so full-height pages
       keep their height.
3. Optional footer:
    1. External playback session bar when a docked session is visible.
4. The window corners and rim (see [Content surface corner](#content-surface-corner)).

**Page layouts.** `readWorkspaceTopBarPage().layout` picks one of two:

1. `scroll`, the redesigned pages (Home, sports, series, movies, countries,
   platforms, search, settings, Mi lista and recent): the body spans the
   window under the bar, and the scroller starts with an 84 px in-flow
   spacer (`.workspace-topbar-spacer`). A page renders right below it and
   owns its padding (`var(--tv-page-top) var(--tv-page-x)
   var(--tv-page-bottom)`, tokens in `apps/web/src/_tv-tokens.scss`); a
   hero or player bleeds back up behind the bar with `margin-top: calc(-1 *
   var(--tv-topbar-h))` and rounds its top corners with
   `--tv-window-radius`. Sticky offsets (`top: 104px`) are measured from
   the scroller's top, as in the handoff.
2. `framed`, every other page (portal lists with their category panel,
   portal title pages, M3U players, sources, downloads): the body starts
   below the bar's row, so full-height layouts keep their height and the
   context panel sits below the bar. A streaming platform's title page
   (`data-platform-theme`) runs to the top under the bar instead, without
   its category panel. Only its artwork rests there
   (`apps/web/src/_platform-themes.scss`): the hero's text and the
   trailer's sound toggle start below the bar, the watch state
   (`shell-host--watch`) starts the player below it, and the player's own
   header row is `no-drag` for when it scrolls up under the band.

Every new page starts at the scroller's top; history Back and Forward
return a page to where it was left, and a change of query parameters alone
keeps the position (`followWorkspaceScroll()`, `workspace-scroll-memory.ts`).

Switching, adding and managing sources, account details, the keyboard
shortcuts sheet and the quick parental lock also live in Settings → Sources
& accounts (`/workspace/settings/sources`). That page reaches the shell
through `WORKSPACE_SHELL_COMMANDS` (`@iptvnator/workspace/shell/util`), which
the shell component provides.

### Content surface corner

`main.workspace-content` (the scroller) sits in `.workspace-content-frame`.
Nothing around the scroller clips with a radius, and the glass window
(`.workspace-window`) does not clip at all. A radius clip used to sit on the
scroller, which made Blink clip every composited effect inside it (the rail
chevrons' and hero controls' `backdrop-filter`, running transform
animations, isolated groups) through a mask layer synthesized per effect:
its shader path for rounded clips needs four equal radii on macOS and a
translation-only transform between the clip and the effect, and the fallback
mask is the size of the whole clipped area, about 24 MB of tile memory at 2x
on a 16" display. A dozen of them took the dashboard past Chromium's 512 MB
tile budget (`tile memory limits exceeded`, blank tiles while scrolling).
`apps/electron-backend-e2e/src/compositing.e2e.ts` guards it: no
drawing layer without an owner node and without a compositing reason (a
synthesized mask, unlike any content layer) may span half the content area,
and the backdrop-filtered controls must really be composited, so the check
cannot pass on a page with nothing to clip.

The browser-style window keeps its 34 px corners (`--tv-window-radius`)
without a clip: the content runs to every edge, and four
`.workspace-corner` pieces, each the radius square, paint the room outside
the curve over it. They use the room's own gradient (`--app-room-bg`, the
dark body's background) with `background-attachment: fixed`, so they match
it pixel for pixel, darkened like the window's drop shadow there, and a
radial mask the size of the piece cuts the curve. The rim and its top
highlight are the window's `::after`, drawn over the content. Where the
window has no corners (the macOS native-glass window, fullscreen, phones,
the light theme) the radius is 0 and the pieces draw nothing. The window
has no `backdrop-filter` of its own: it would become the backdrop root of
the bar's glass, which then stops blurring the page scrolled under it.

### Layout slides

When a route change adds or removes the context panel, the content frame
moves by the panel's width (323 px on desktop). It happens in the frame
that swaps the page, so it used to be one jump: a layout shift of 0.233 in
the open-source journey,
0.222 of it the content frame (see
[performance journeys](./performance-journeys.md#j2-open-source-open-a-source-to-a-browsable-list)).

`LayoutSlideDirective` (`workspace-shell/layout-slide.directive.ts`) turns
these jumps into a 180 ms slide, the duration of the context panel's own
width transition. The new layout applies at once; each target starts
translated back to the position it had and animates its transform to none
(FLIP), so nothing waits for the animation and Chromium records no layout
shift for a transform. The shell's `.workspace-body` slides
`.workspace-content-frame` when `showContextPanel` changes. (The removed
header also slid its controls when Back appeared; the top bar moves
nothing.)

1. **Previous positions.** `offsetLeft` values, which ignore transforms, are
   recorded after every render in which the slide key or the record key
   changed and when the host or a target resizes (window resize, a context panel folding
   or being dragged wider). A slide therefore starts where the target was
   last laid out, and a target that has no recorded position or did not move
   is left alone.
2. **The uncovered strip.** The frame is narrower beside the panel than
   without it, so the side it moves away from would show the body colour
   during the slide. While a slide runs the target carries
   `layout-slide-active` and the uncovered widths as `--layout-slide-start`
   and `--layout-slide-end`; the frame's stylesheet extends the content
   surface over that strip with an `::after` below the scroller.
3. **Back fades in** over the same 180 ms, so the switcher still sliding away
   from its slot does not draw over the arrow.
4. **Reduced motion.** Under `prefers-reduced-motion` there is no animation:
   the jump (and its layout shift) remains.
5. **Compositing.** While it runs, each slid target is its own composited
   layer (`ActiveTransformAnimation`): the frame at its width plus the
   covered strip (1220×664 CSS pixels at 1280×720), the header controls a
   few small ones. No synthesized clip mask appears, because no ancestor of
   the frame clips with a radius ([content surface
   corner](#content-surface-corner)), and the layers go away when the slide
   ends: `perf:compositing` reads the same layer and mask counts on every
   route as before the slides (#1895).
6. **Not covered.** A slide does not change what the route renders. Going
   back from a portal to the dashboard used to lay the new dashboard out
   below the old page before the old page left, a shift a slide cannot
   hide. That was the route swap, fixed at its cause (see
   [Route swaps](#route-swaps)).

`WorkspaceShellComponent` binds only to `WorkspaceShellFacade`. The facade is
kept as a thin template-facing API and delegates ownership to component-scoped
services:

1. `WorkspaceShellRouteStateService` owns current route parsing, rail links,
   context-panel state, dashboard startup preference, and playlist source
   signals.
2. `WorkspaceShellSearchService` owns the route-aware search capability (the top bar's Buscar)
   and public search actions.
3. `WorkspaceShellSearchSyncService` owns the search query signals, debounced
   application, provider-store synchronization, and query-param sync.
4. `WorkspaceShellHeaderService` owns playlist title/subtitle, account/info
   actions, and refresh action state. It has no clear action: clearing
   recently viewed or favorites belongs to the collection page.
5. `WorkspaceShellCommandPaletteService` owns command-palette dialog lifecycle
   and recent-command recording.
6. `WorkspaceShellXtreamImportService` owns Xtream import/refresh overlay
   state and labels. Remote import phases and refresh preparation of the
   shown playlist (of any playlist on the dashboard) show the overlay at
   once. A session that has only read the saved catalog (`loading-cached`,
   `isImporting` still false) shows it only after
   `XTREAM_LOCAL_LOAD_OVERLAY_DELAY_MS` (300 ms), so a warm open goes from
   the skeleton to the page without flashing the overlay, while a slow or
   stuck cache read still blocks and stays cancellable. The overlay covers
   the window below the top bar only (`top: inset + --tv-topbar-h`): the
   import belongs to the page (another tab leaves it), so the bar stays
   usable and unblurred.

When adding shell behavior, prefer placing it in the service that owns the
nearest existing state. Keep `WorkspaceShellFacade` as a stable re-export layer
for the template unless the template contract itself intentionally changes.

### Route swaps

The router's activation runs in one task, outside change detection:
deactivation destroys the old routed view, then activation creates the new
one and inserts its host element into `main.workspace-content` at once.
`WorkspaceShellRouteStateService.currentUrl` is set on `NavigationEnd`, which
the router emits synchronously after activation, so the shell's state does
not lag the outlet. The shell re-renders (the context panel leaves, the
content frame slides) in the next change detection. With event coalescing
that runs in the next `requestAnimationFrame`, before that frame paints.

The app does not provide `provideAnimations()`. Nothing uses
`@angular/animations` triggers (Material animates with CSS), and that
package's renderer queues every DOM removal until the end of the next change
detection, while insertions apply at once. Leaving a portal section for the
dashboard therefore inserted the dashboard below the still-present portal
page, and the old page left only in the coalesced tick. In between, Chromium
laid out the document with both pages, the dashboard at y=720 in a 720 px
window, and scored the swap as one layout shift: 0.337 at 1280 px, 0.394 at
900 px, 0.723 at 420 px (measured with a `layout-shift` observer in the
`electron-performance` build). With the default DOM renderer the old page is
removed in the same microtask, before the new one is inserted, and the swap
records no shift. `app.config.spec.ts` keeps the animations renderer out, and
`workspace-route-swap.e2e.ts` asserts that no mutation checkpoint holds both
pages and that neither the dashboard nor the content pane shifts.

Destroy hooks therefore run with the view's DOM already detached; the
[UI guidelines](./iptvnator-ui-guidelines.md) ("No animations module") say
how hooks record geometry and focus instead.

Do not add `provideAnimations()` or `provideAnimationsAsync()` back; animate
with CSS. A leave animation (`animate.leave` included) delays its element's
removal in the same way, so a routed page must not carry one.

## Header Back

The top bar's Back circle is the workspace's one page-level Back. Pages do not
render an arrow of their own: they register a `WorkspaceBackTarget`
(`@iptvnator/portal/shared/util`) with `WorkspaceBackNavigationService`
(`@iptvnator/portal/shared/data-access`), normally through
`registerWorkspaceBack()`, which registers for the calling component's
lifetime while its optional `available` predicate holds. The newest
registration wins, and each release removes only its own target. The button
(`data-test-id="workspace-header-back"`) sits in the bar's left group after
the macOS traffic lights, never scrolls, and has Electron `no-drag` hit
testing. The pages the bar reaches itself (the tabs, Buscar, Ajustes) do not
show the history fallback, and a league page shows "‹ Deportes" instead;
their registrations still serve Escape and the platform gestures. A tab's
own page shows Back only for a page registration
(`WorkspaceBackNavigationService.pageTarget`, the newest registration
without the fallback): a detail it opened in place, such as a title over
Mi lista, keeps the tab's URL, so the tab itself cannot leave it; clicking
the lit tab again runs the same Back. Buscar and Ajustes never show it. A
target supplies its label (else the translated "Back"), whether Escape on
the page runs it, and `run()`.

"‹ Deportes" runs `WorkspaceBackNavigationService.up('/workspace/sports')`:
history Back while the previous in-app entry is the hub, so the league page
becomes Forward instead of the next Back (it starts a stream); otherwise
the hub replaces the league page (`replaceUrl`), as it does without the
Navigation API. A modified click keeps the link's default.

| Page | Registered by | Back runs | ≤640 px |
| --- | --- | --- | --- |
| Portal, collection, offline and recording details | `PortalDetailShellComponent` while `backAvailable()` | the host's `backClicked` | replaces the drawer toggle |
| Xtream and Stalker Discover and actor pages | `DiscoverViewComponent`, `ActorViewComponent` | the route's history Back; parent: the catalog section Discover lists (`vod` for movies, `series` for TV), the portal's default section for actor | (no drawer) |
| In-portal search, Xtream and Stalker | `SearchLayoutComponent` while `backAvailable()` and no inline detail replaces the results | history Back; parent: the portal's default section | (no drawer) |
| TiagoTV platform page, a row shown whole (`?row=`) | `PlatformPageComponent` while a row is open | history Back; parent: the platform's overview | (no drawer) |
| Settings | `SettingsRailComponent`, the settings page's rail, which exists exactly while the settings route shows; it also leaves settings on Escape, listened to in the capture phase because a showing tooltip (the Ajustes circle's) hides on Escape and stops it at `<body>`; overlays with a backdrop, fields, fullscreen and an inert page (the full-window player) keep the key | history Back; parent: the first workspace view (`WorkspaceStartupPreferencesService.resolveDashboardPath()`: the dashboard, or sources when it is hidden) | (no drawer) |

Detail-page semantics (Escape, browse and watch) are in
[Portal Detail Navigation](./portal-detail-navigation.md#detail-scroll-and-focus).

**History fallback.** Without a registration, the bar shows Back while the
previous history entry is an in-app one, and runs `Location.back()`. The
service reads that from the Navigation API: the previous entry must be
same-document (`NavigationHistoryEntry.sameDocument`), so the router pushed it
after this document loaded. Entries from before a reload or from another page
of the origin never count, and the fallback can neither leave nor reload the
app. `currententrychange` keeps it current through pushes, replacements,
traversals and guard-cancelled Back navigations that the router rewrites.
Without the Navigation API (older Safari and Firefox, jsdom) there is no
fallback; registered pages are unaffected. The fallback reads "Back" and
advertises no Escape, because no page handles one for it. Pages that set
`backAvailable=false`, such as M3U details, therefore show it too when they
were reached by navigation.

**Parent fallback.** "Parent" in the table above: a registered page whose
Back is history Back calls `WorkspaceBackNavigationService.back(resolveParent)`
instead of `Location.back()`. It runs `Location.back()` while the previous
entry is an in-app one, by the same Navigation API test as the history
fallback. Without the API (older Safari and Firefox) the router's history
depth decides (`trackRouterHistoryDepth`): the document's first navigation is
depth 0, a push adds one, a replacement keeps it and a traversal restores the
depth recorded for its entry. The lazy workspace shell creates the service
after the first navigation began, so the tracker adopts the router's current
or last navigation: a first one is depth 0, a later one leaves the depth
unknown. A traversal to an entry from before a reload
leaves the depth unknown and keeps `Location.back()`, which then has a
previous entry. Otherwise the page opened
the session (a deep link, a reload or a restored view), where
`Location.back()` does nothing in Electron and leaves the app in a browser.
The service then navigates to the page's parent with `replaceUrl`, so history
Back cannot return to the page just left; with nothing in-app before it, the
parent shows no history fallback. The resolver returns a URL or router commands, may be asynchronous, and
returns null when the page knows no parent, which keeps `Location.back()`.
Portal pages build their parent with `workspacePortalCommands()`
(`@iptvnator/portal/shared/util`) from the route's `:id`; without a section,
the portal route's `redirectTo` picks the default section within the same
navigation, so the replacement still applies. Detail pages keep their own
return logic (`backClicked`). The Xtream title pages' is
`injectXtreamDetailBack()`: this parent fallback with the title's tab page as
parent (`/workspace/movies`, `/workspace/series`), so a deep link, a fresh
tab or an entry from before a reload never leaves or reloads the app. It
never closes a playing player first: the navigation tears the page down and
hands the stream to the mini-player (Escape in watch mode stays the explicit
close). A collection's inline detail (Mi lista, Recientes) closes in its
collection instead (`XTREAM_INLINE_DETAIL_CLOSE`): history Back to the list,
or the list in place when the detail opened the session.

When there is nowhere to go, the slot is empty rather than a disabled arrow.
Sessions often start on a page that never navigates (an M3U playlist or live
TV), where a disabled arrow would stay for the whole session. When Back first
appears or leaves, which happens only at the start of the history and together
with a route change, the switcher and search slide by the slot's width instead
of jumping (see [Layout slides](#layout-slides)).
There is no Forward button: Stalker inline details are store state, not
history entries, so Forward would skip them. History Forward has gestures
only (below): `WorkspaceBackNavigationService.goForward()` steps only to an
in-app entry ahead (same-document, Navigation API; nothing without it).

**Platform gestures.** The mouse Back button, Alt+← (Cmd+[ on macOS) and, in
Electron, the window's `app-command` `browser-backward` (Windows and Linux:
mouse Back buttons and the Browser Back key) and trackpad `swipe` left (macOS)
run the same action as the Back button, through
`WorkspaceBackGesturesService` (shell-provided). Each gesture has one of
three results (`WorkspaceBackGestureResult`):

- `back`: the workspace has a Back target and nothing sits above the page, so
  `WorkspaceBackNavigationService.goBack()` runs. "Above the page" is document
  fullscreen (a fullscreen player), an open phone context drawer, a showing
  CDK backdrop, or a visible `[role="dialog"]`, `[role="alertdialog"]` or
  `[role="menu"]` outside hidden, `inert` or `aria-hidden` subtrees.
- `blocked`: something sits above the page. Nothing navigates, and the
  gesture is still swallowed, because browser Back would navigate under the
  dialog (which then closes) or out of the fullscreen player.
- `none`: the workspace has no Back. The gesture stays the browser's: in the PWA
  it may leave the app, as browser Back does.

Unless the result is `none`, the browser's default is prevented (the mouse
press on `mouseup` and `auxclick`, listened to in the capture phase), so the
browser cannot take a second history step. In Electron the mouse Back button
is prevented even then: Electron's Chromium steps through history on an
unprevented press itself, also to entries from before a reload, which reloads
the app.

- **Chord.** `navigate-back` in `keyboard-shortcut-definitions.ts` lists it in
  the shortcuts dialog; `isWorkspaceBackShortcut()` matches it, on macOS also
  by the `BracketLeft` key position for layouts that type `[` with Option.
  `WorkspaceKeyboardShortcutsService` handles it in a capture-phase document
  listener and stops a chord that runs Back there, so a focused carousel, tab
  list, guide or player does not also read it as a plain arrow; a blocked
  chord is prevented but still reaches the dialog or menu. It is ignored
  while typing (Alt and Option arrows edit text). A held chord runs Back
  once: its repeats follow its first press until a key is released, so after
  a press that ran Back they are swallowed even when the page it reached has
  no Back left, and the browser cannot step on them.
- **Forward.** Cmd+] on macOS (also by the `BracketRight` key position),
  Alt+→ elsewhere (`isWorkspaceForwardShortcut()`, `navigate-forward` in the
  shortcuts dialog) and, in Electron on macOS, the trackpad swipe right run
  `WorkspaceBackGesturesService.goForward()`: `forward` to an in-app entry
  ahead, `blocked` under the same surfaces as Back, `none` otherwise (the
  chord stays the browser's). The chord is handled like the Back chord
  (capture phase, not while typing, once per held chord). The mouse Forward
  button stays Chromium's own.
- **Electron.** `attachWindowBackGestures()`
  (`apps/electron-backend/src/app/services/window-back-gestures.ts`) forwards
  the two window events over the main → renderer push channel
  `WINDOW:BACK_REQUESTED` with the source (`app-command` or `swipe`); the
  preload's `onWindowBackRequested` passes only those two values on. The
  renderer subscribes only when
  `RuntimeCapabilitiesService.supportsWindowBackGestures` reports the
  subscription, so an older preload forwards nothing. `swipe` right goes
  over `WINDOW:FORWARD_REQUESTED` (`onWindowForwardRequested`, capability
  `supportsWindowForwardGestures`; a main process and preload from before
  it, which only a new installer replaces, send nothing). `browser-forward`
  is not forwarded: Chromium already steps Forward on the mouse button
  behind it, so one press would step twice. `swipe` needs macOS's "Swipe between
  pages" set to two or three fingers. On Linux Electron raises `app-command`
  for the keydown and the keyup of the Browser Back key alike, so the main
  process takes that key in `before-input-event` instead (Back once per
  press, the key never reaches the page) and leaves `app-command` to mouse
  Back buttons.
- **One press, two events.** In Electron on Windows and Linux a mouse Back
  press also reaches the window as `app-command`: with the release on
  Windows, on press on Linux, and before or after the renderer sees the
  button. Whichever half comes first runs Back and the other is consumed. A
  command that arrives while the button is down belongs to that press however
  long it is held; otherwise a command and a press (or a press and a command)
  within `BACK_PRESS_TWIN_MS` (500 ms) of each other pair. Each press pairs
  once, so two quick presses still go back twice, and the chord and the swipe
  never pair.

Electron E2E `back-gestures.e2e.ts` drives each gesture (the mouse through
CDP's `back` button, the window events emitted on the `BrowserWindow`) and
checks that each goes back one history entry, a paired press goes back once
(also when held), `browser-forward` does nothing while the swipe right steps
Forward, and the gestures wait while typing
(the chord) or with a dialog open. Web E2E `workspace-header-back.e2e.ts`
checks that the mouse Back button and the chord step once in the browser.

**Phone width.** `phoneDrawerToggle` sets how Back shares the leading slot with
the context drawer toggle. `replace` (the default) takes the toggle's slot: a
detail page's drawer belongs to the list that Back returns to. `beside` keeps
both: a page whose own sections live in the drawer. `yield` hides Back
while the toggle shows: the history fallback must not cost a category list its
only way into the drawer, and two navigation icons do not fit beside the
switcher. The platform gestures above and browser Back still work there.

**Left in place.** These controls stay inside their surface on purpose:

1. Downloads offline and recording detail error states keep their labelled
   "Back to Downloads" button beside Retry or Remove. It is the error state's
   recovery action, not page chrome; the top bar shows the same Back.
2. Back controls internal to a surface, which leave a panel rather than the
   page: the Embedded MPV dock panel and the alternative-sources panel inside
   the VOD "…" menu.
3. The M3U player sidebar's Home button, which renders only outside the
   workspace shell.

## Context Panel Rules

The shell decides which secondary panel to show from the current route:

1. `/workspace/sources`
    1. `WorkspaceSourcesFiltersPanelComponent`
2. Xtream category sections (`live`, `vod`, `series`)
    1. `WorkspaceContextPanelComponent`
3. Stalker category sections (`itv`, `radio`, `vod`, `series`)
    1. `WorkspaceContextPanelComponent`
4. `/workspace/settings/:section`
    1. none: the settings page draws its own rail (`SettingsRailComponent`)
5. Downloads sections
    1. `WorkspaceCollectionContextPanelComponent`

The context panel is part of the shell contract. New workspace-level routes
should explicitly decide whether they need one rather than adding local
sidebars inside feature pages.

Xtream and Stalker category panels preserve provider/server category order by
default. The panel header exposes a sort menu next to category search with
`Server sorting`, `A-Z`, and `Z-A`; when alphabetical sorting is active,
synthetic "all categories" entries stay pinned before sorted provider
categories. Search and sort render disabled while the categories load (beside
the disabled Manage categories button), so the header row has its final width
under the skeleton instead of growing by two buttons when the list arrives;
they are hidden only once a load ended with no categories.

On live sections the category panel can be folded away independently of the
channels list; the folded panel is reachable as a popover from the channels
header through the `LIVE_CATEGORIES_POPOVER` token the shell provides. The
three nested levels, their affordances and persistence are specified in
`iptvnator-ui-guidelines.md` ("Collapsible Live Sidebar").

A category click in a LIVE section (Xtream `live`, Stalker `itv` and `radio`)
changes only the selected category: the live layouts gate their player on the
store's selected item, so the handler must not clear it — the channel the user
is watching keeps playing while the sidebar re-filters (Xtream: #936; Stalker:
`onStalkerCategoryClicked` returns before `clearSelectedItem()`). VOD and
series category clicks do drop the open detail (`setSelectedItem(null)` /
`clearSelectedItem()`) because they navigate to a list route.

The channel header offers **Show playing channel** when browsing excludes the
active channel. It returns to that category and focuses the row without
restarting playback; remote commands retain captured playback order. See the
[queue and reveal contract](./remote-control.md#live-channel-return-and-playback-order).

## Search And Navigation Rules

Search is shell-owned and route-aware:

1. On settings routes, searches the settings themselves (see
   [Settings search](#settings-search)).
2. Enabled on sources routes.
3. Enabled for `/workspace/search`, TiagoTV's search page
   (`SearchPageComponent`, see [Workspace dashboard](./workspace-dashboard.md#search-page);
   every runtime): its own field writes `q`. `Ctrl/Cmd+F` in Electron opens this route
   (on it, Buscar and find focus the page's field) instead of opening a
   fullscreen dialog; on a page that filters itself it focuses the top bar's
   search field instead.
4. Enabled for supported Xtream and Stalker content/search views.
5. Placeholder text and search handling vary by provider and section.
6. Input changes are debounced before route/store updates are applied.
7. The top bar's search field (Buscar on a page that filters itself) writes
   the search phrase to the `q` query parameter, so history/back-forward
   behavior matches the rest of the workspace.
8. The URL is authoritative for the search box only when it carries search
   intent. `WorkspaceShellSearchSyncService` re-reads `q` on every
   `NavigationEnd`, but an **app-initiated** navigation that stays on the same
   page and carries the term already applied is always ignored — whether or
   not a debounce is still pending. Otherwise a page writing an unrelated
   query param (a downloads filter chip, a refresh bump) or the router echoing
   back our own trimmed `q` would reset the box to the applied term, eating
   everything typed since: the whole word while the first keystroke is still
   debouncing, or a just-typed trailing space once the debounce has fired
   ("Bein " would snap to "Bein" and typing on would yield "BeinSports").
   Applied terms are always stored trimmed (`applySearchQuery` and
   `setSearchState` both trim), so the echoed `q` compares directly; the box
   keeps exactly what the user typed. Pages are free to write their own query
   params while the user types; they must not assume the shell will re-apply
   the search afterwards.
9. Browser history overrides that guard. The exemption is keyed on
   `Navigation.trigger === 'imperative'`, so back/forward always re-applies
   what the history entry carries, even mid-typing.
10. Applying a term explicitly supersedes a queued one. `applySearchQuery()`
    cancels any pending debounce, so the Enter key committing a trimmed term
    cannot be overwritten a moment later by the untrimmed keystroke still
    waiting behind it.

Rail navigation is also shell-owned:

1. Workspace-global entries are static.
2. Provider entries come from `buildPortalRailLinks(...)`.
3. On dashboard, sources, settings, global search, global favorites, and global
   recent, the shell falls back to the currently selected playlist so provider
   navigation remains available even outside a provider route.

Command palette behavior is shell-owned but view-extensible:

1. The shell resolves commands into groups in fixed order: current view,
   this playlist, global, then settings. The settings group appears only for a
   non-empty query and holds at most six settings matches (see
   [Settings search](#settings-search)).
2. Shell-owned commands are derived from route context and current playlist
   state; empty groups are omitted instead of rendering disabled placeholders.
3. Workspace features contribute current-view commands through
   `WorkspaceViewCommandService`.
4. Header shortcut actions can opt into palette exposure by attaching palette
   metadata through `WorkspaceHeaderContextService`.
5. Filtering matches command labels, descriptions, and keywords, and keyboard
   selection always lands on the first enabled command.
6. A "Recently used" section is rendered above the standard groups when the
   query is empty and at least one stored id resolves to a visible+enabled
   command; ids are persisted via `RecentCommandsService` (capped at 5,
   stored at `STORE_KEY.RecentCommands`). Storage is **not** pruned by route
   visibility — a navigation command like `Open sources` is invisible while
   the user is on `/workspace/sources` but the id stays in storage so it
   reappears in the recent section after navigating away.
7. Six "Switch player to X" commands are registered globally by
   `WorkspacePlayerCommandsContributor` (VideoJS, HTML5, ArtPlayer, Embedded
   MPV, MPV, VLC). Each command carries a `requires` flag gating its
   visibility: the MPV/VLC ("managed-external") entries are visible only when
   `RuntimeCapabilitiesService.supportsManagedExternalPlayers` is true, and the
   Embedded MPV ("embedded-mpv") entry is visible only after the command
   palette lazily preloads an async `window.electron.getEmbeddedMpvSupport()`
   check and it resolves to `supported` (mirroring the Settings dropdown gate).
   Do not run this Embedded MPV support check from workspace shell bootstrap:
   supported desktop builds may load the native addon while resolving
   capabilities. The entry matching the current `SettingsStore.player()` value
   is disabled. The new player setting applies to the next playback session; an
   existing stream is not re-mounted.

### Settings search

Settings rows are searchable from the top bar's search on `/workspace/settings`
and from the command palette. Both use the same index and ranking.

1. The index is `SETTINGS_SEARCH_ENTRIES` in
   `libs/workspace/shell/util/src/lib/settings-search/`, published through the
   `@iptvnator/workspace/shell/util/settings-search` sub-entrypoint. Eager
   code imports the main shell util barrel, so the index stays out of it and
   ships only in lazy chunks (the initial-bytes ratchet enforces this).
2. Each entry names its section, title and description translation keys,
   untranslated synonyms (`keywords`), runtime `requires`, and an optional
   `fallbackId`. Section definitions (`SETTINGS_SECTION_DEFINITIONS`) are the
   single source for the settings navigation too.
3. Every titled `.setting-item` in the section templates carries
   `data-setting-id`. `settings-search-registry.spec.ts` fails when a row, id,
   title key or description key drifts from the index, so a new settings row
   must be added to the index in the same change.
4. `SettingsSearchService.search()` matches the translated title and
   description of the current language plus the keywords; every query token
   must match (AND), and a label prefix outranks a word start, which outranks
   an inner match. Rows whose `requires` the runtime lacks are never returned.
   Embedded MPV rows depend on a lazy support probe
   (`ensureEmbeddedMpvSupportLoaded()`), run when the settings page or the
   command palette opens, never from shell bootstrap; frame copy also needs
   `frameCopyAvailable`, matching the settings page gate.
5. Settings routes use `local-filter` search mode, so the term lives in `q`.
   While `q` is set, the settings page shows ranked results in place of the
   section page and the settings rail shows per-section match
   counts, muting sections without matches. The search box is shown on
   settings even when no playlist exists.
6. Choosing a result, pressing `Enter` in the top bar's search (best match), or
   picking a settings command in the palette calls `reveal()`: it navigates
   to the section page without `q` (which clears the box) and the page
   scrolls to, focuses, and briefly highlights the row once the form is
   hydrated. A row hidden by the current form state falls back to its
   `fallbackId`, the control that makes it appear. A reveal must win over the
   typed term: `WorkspaceShellSearchSyncService` drops a keystroke still
   waiting for its debounce through `onReveal()`, and Enter does not apply
   the term first, because either `q` sync navigation would supersede the
   reveal navigation. Keyboard users keep a `:focus-visible` ring on the row
   after the highlight fades.
7. `Ctrl/Cmd+F` on settings focuses the top bar's search instead of opening
   global search.

Keyboard shortcut help is shell-owned:

1. `WorkspaceKeyboardShortcutsService` is provided by `WorkspaceShellComponent`.
   It owns the workspace-scoped `document:keydown` listener for `?` /
   `Shift+/`, and a capture-phase one for the Back chord (see
   [Header Back](#header-back)).
2. The listener ignores events from inputs, textareas, selects, and
   content-editable elements via `isTypingInInput(...)`.
3. `libs/portal/shared/util/src/lib/keyboard-shortcut-definitions.ts` is the
   metadata registry for shortcuts shown in the help dialog and documented in
   README. `keyboard-shortcuts.ts` owns the display transformation and help
   trigger detection.
   Shortcuts that only work through the Electron bridge, such as embedded MPV
   controls, must set `electronOnly: true` so the PWA dialog does not advertise
   unavailable commands.
4. New custom shortcuts should be added to that registry when the handler is
   added. Do not include native browser/editor behavior such as `Tab` or
   platform text editing shortcuts.

## Window Chrome And Custom Title Bar

The Electron window hides the native title bar on all desktop platforms
(`titleBarStyle: 'hidden'` in `apps/electron-backend/src/app/app.ts`):

1. macOS keeps the native traffic lights (`titleBarOverlay: true`,
   `trafficLightPosition` from `MACOS_TRAFFIC_LIGHTS_POSITION` in
   `@iptvnator/shared/interfaces`); the renderer draws no window buttons.
   The lights sit in the top bar, 22 pt in and centred on its 84 px band
   (`{ x: 22, y: 35 }`, the handoff's position); the bar's left group starts
   after them (`--traffic-lights-clear-x`) and its band moves the window
   (`app-region: drag`, the groups `no-drag`). A main process built before
   the bar still draws them at `{ x: 16, y: 20 }` until a new installer
   replaces it: they then sit above the bar's centre, and the clearance (90
   window points) still clears them (they end at 76). In the macOS
   native-glass window and in fullscreen the glass window fills the native
   one with no inset, rim or radius, and the content runs to all four edges;
   a fullscreen window has no lights. The now-playing pill's room
   (`--workspace-now-playing-clearance`: 56 px, 92 px on the macOS glass and
   in fullscreen, none without the pill) is kept at the scroller's foot, and
   inside their own ground by a streaming platform's page and its titles'
   pages (`data-platform-theme` on `<html>`: the platform page's bottom
   padding and the title page's `app-portal-detail-shell`, in
   `apps/web/src/_platform-themes.scss`).

   App zoom (see "Zoom level") scales CSS pixels but not the lights. On
   macOS, `TrafficLightsClearanceDirective` on `.workspace-shell` reads the
   page zoom factor (`outerWidth / innerWidth`, refreshed on `resize`) and
   publishes the clearance in CSS pixels as `--traffic-lights-clear-x` (90
   window points: the lights plus a gap), `--traffic-lights-clear-y` (63:
   the lights' bottom plus a gap) and `--traffic-lights-band-h` (84: the
   band centred on the lights). Zoomed out (the app's default zoom is about
   83 %) the shell grows the one-row bar to that band
   (`--tv-topbar-h: max(84px, var(--traffic-lights-band-h))` on
   `.workspace-shell.has-traffic-lights`); zoomed in, the 84 px bar is
   taller than the band and lifts its row onto the lights' line instead
   (`--topbar-lift`, the room left under the band), so the lights stay on
   the capsule's centre line at every zoom. The two-row bar centres its
   first row on them (`--workspace-topbar-stacked-top`: half the band less
   half the 52 px row, at least 4 px). Off macOS nothing is published and
   the defaults apply. In fullscreen macOS hides the lights, so all three
   are `0px` there. `--traffic-lights-clear-y` is also set on `<html>`:
   dialogs render in the CDK overlay container, outside the shell, and
   `dialogSize()` (`libs/ui/components/src/lib/dialog-shell/dialog-size.ts`)
   keeps a centred dialog `max(16px, var(--traffic-lights-clear-y))` from
   both window edges, so its header never sits under the lights (at 125 %
   on a 900 pt window the clearance is 50 CSS px). Dialogs with their own
   `maxHeight` (the account info's `90vh`) keep it. `window-controls.e2e.ts` ("macOS traffic lights") was written for
   the header band and needs updating to this layout.

   Fullscreen is `window-fullscreen` on `<html>`, set by
   `startWindowChrome` (`apps/web/src/app/services/native-glass.ts`) from
   the source `RuntimeCapabilitiesService.windowFullScreenSource` names:
   `events`, the main process's push through the preload's
   `onWindowFullScreenChange` (below), on every platform; `query`, for an
   installed macOS main process from before that push (interface updates
   run on it), `getWindowState` asked at start, after every resize and once
   more a second after the last; `size`, everywhere else (browser, PWA,
   older Windows/Linux builds), a window at least as large as the screen.
   The size cannot be trusted on macOS: a notched Mac's fullscreen window
   sits below the notch, exactly as large as a zoomed window.
2. Windows and Linux use renderer-drawn window controls
   (`app-window-controls`, `libs/ui/components/src/lib/window-controls/`).
   `frame` is intentionally left untouched so native resize borders and
   window snapping keep working.

The controls are mounted once in `app-root` (not inside the workspace
header) as a `position: fixed` top-right overlay so they stay clickable
above full-window content such as Material dialog backdrops — the same behavior as the macOS traffic lights. Because
CDK overlays render as popovers in the browser top layer (above any
z-index), the component host is itself a `popover="manual"` element: it
enters the top layer on init and re-enters it (hide + show) whenever
another popover opens, so the controls always paint last. The
`z-index: 10000` remains only as a fallback when the popover API is
unavailable. They render only when
`RuntimeCapabilitiesService.usesCustomWindowControls` is true (Windows/Linux
Electron with the window-control bridge methods available); the PWA and
macOS never mount them.

IPC contract (constants in `libs/shared/interfaces/src/lib/ipc-commands.ts`,
handlers in `apps/electron-backend/src/app/events/window.events.ts`):

1. `WINDOW:MINIMIZE`, `WINDOW:TOGGLE_MAXIMIZE`, `WINDOW:CLOSE`,
   `WINDOW:GET_STATE` are `ipcMain.handle` channels resolved from the sender
   WebContents. Close goes through `win.close()` so the existing
   window-bounds persistence in `app.ts` still runs.
2. `WINDOW:STATE_CHANGED` is pushed main → renderer on every platform
   (`apps/electron-backend/src/app/services/window-state-events.ts`) on
   maximize/unmaximize and on the fullscreen events —
   `enter/leave-full-screen` plus the `enter/leave-html-full-screen`
   variants emitted for HTML-element fullscreen (video player
   fullscreen) — so the maximize/restore glyph stays correct for
   externally triggered changes (double-click on a drag region, OS
   snap, F11). The controls hide themselves while the window is
   fullscreen. The tracked state is sent again at each `dom-ready` (first
   load, reload, an interface update's build), so a new document learns a
   fullscreen launch or a reload in fullscreen. The preload listens from
   before the page's scripts and hands the latest `isFullScreen` to
   `onWindowFullScreenChange` subscribers at once, then each change: the
   renderer's `window-fullscreen` class (above) follows it. Earlier main
   processes skipped the push on macOS; `onWindowFullScreenChange` came
   with it, so its presence tells a renderer the push arrives. Earlier
   renderers ignore the macOS push: they subscribe only for the
   Windows/Linux controls.

    Window state is **never re-read at event time**. `attachWindowStateEvents`
    seeds `{ isMaximized, isFullScreen }` once at window creation and each
    event patches only the flag it names; every push carries a copy of that
    tracked state. On Windows both getters can still report the
    pre-transition value while the matching event fires — `isFullScreen()`
    stays `true` during an HTML fullscreen exit, and `isMaximized()` reads
    `false` while the window is fullscreen. Because the renderer replaces
    both flags on every push and no later event corrects a stale one,
    polling left the controls hidden forever after leaving fullscreen and
    stuck the maximize/restore glyph on the wrong icon. Regression coverage:
    `window-state-events.spec.ts`, `window-controls.e2e.ts` and, for the
    fullscreen mark, `preload-window-fullscreen.spec.ts`,
    `native-glass.spec.ts` and `window-fullscreen.e2e.ts`.

    The pushed `isFullScreen` is the OR of two flags tracked apart: native
    (OS-level, fed by `enter/leave-full-screen`) and HTML-element (fed by
    the `*-html-*` pair). Electron remembers when the window was already
    natively fullscreen before the player entered HTML fullscreen and then
    leaves ONLY the HTML state on exit — no `leave-full-screen` fires and the
    window stays fullscreen — so a single flag cleared by
    `leave-html-full-screen` would un-hide the controls over a window that
    is still fullscreen. A fullscreen launch (below) or F11 followed by the
    player's `F` → `Esc` makes that path routine on Windows/Linux.

3. `WINDOW:TOGGLE_FULLSCREEN` toggles OS-level fullscreen (`setFullScreen`)
   and, like the maximize toggle, reports the requested state and leaves
   the `WINDOW:STATE_CHANGED` push authoritative. Because the transition is
   asynchronous — `isFullScreen()` reports the old value until it lands,
   and on Windows even while the matching event fires — a toggle must
   never be decided against the getter. Every native fullscreen request
   goes through the tracker in
   `apps/electron-backend/src/app/services/native-fullscreen-transitions.ts`
   (the F11 toggle AND the startup fallback below). Like the state pushes
   above it keeps its own per-window fullscreen state, seeded from the
   getter once at window creation (`trackNativeFullScreen` in
   `initMainWindow`, while no transition can be in flight) and fed
   afterwards only by the `enter`/`leave-full-screen` events, which also
   cover transitions the app did not request. A toggle is decided against
   the pending target while a transition is in flight, else against that
   tracked state: two quick presses are an enter-then-exit, not two enters,
   and F11 during the startup animation leaves fullscreen instead of asking
   for it again. The tracker observes and never issues a request on its
   own. The pending record is the LATEST requested target: an event landing
   on it clears it, an event landing on the other state (an earlier request
   of a burst landed first; ours is still queued) leaves it in place so the
   next press still follows the user's latest intent, and a record older
   than `FULLSCREEN_TRANSITION_TIMEOUT_MS` (2 s) is ignored. Events cannot
   say which request they belong to, so any automatic "repeat the target"
   on a mismatch is indistinguishable from reversing the user's own
   green-button/Ctrl+Cmd+F action and is deliberately not done: should a
   platform ever drop a queued request (Electron queues them on macOS and
   applies them synchronously elsewhere), the record expires, the event-fed
   state takes over and the next press corrects the window. The renderer
   binds it to
   **F11** in `WorkspaceKeyboardShortcutsService` (deliberately not gated
   by `isTypingInInput` — it must work from any focus, because it is the
   only exit from a fullscreen launch on Windows/Linux, where the title bar
   is hidden and the controls hide themselves) and skips the key while
   `document.fullscreenElement` is set, since the player's own `F` / `Esc`
   own HTML fullscreen and F11 must not yank OS fullscreen out from under
   it. Without a bridge (PWA) F11 is left to the browser.

Startup window mode (`Settings.startupWindowMode`, issue #1455):

1. `normal` (default) / `maximized` / `fullscreen`, chosen in Settings →
   General ("Window on startup"). Electron only — the select renders only
   when `RuntimeCapabilitiesService.supportsStartupWindowMode` sees both
   `updateSettings` and `toggleFullScreenWindow` on the bridge, so the mode
   is never offered without its F11 exit.
2. Settings live in the renderer's IndexedDB, which the main process cannot
   read at window creation, so the `SETTINGS_UPDATE` handler mirrors the
   value into electron-conf (`STARTUP_WINDOW_MODE`, the same pattern as the
   frame-copy flag) and `initMainWindow` reads it synchronously. A change
   therefore applies on the next launch. Both sides normalize through
   `normalizeStartupWindowMode`, so junk never reaches the config file or
   the window options.
3. `fullscreen` is the `BrowserWindow` constructor option: on Windows/Linux
   the window is created hidden and enters fullscreen before its first
   paint. macOS ignores the option while the window is hidden (an NSWindow
   only toggles fullscreen once it is on screen), so the first show repeats
   the request with `setFullScreen(true)` right after `show()` wherever
   `isFullScreen()` is still false — never unconditionally, or the
   platforms that honoured the option would animate a second toggle. The
   saved bounds stay spread into the options — they are the normal bounds
   the window returns to, and the close handler keeps persisting
   `getNormalBounds()`. `maximized` calls `maximize()` right before the
   first `show()`, never earlier: `maximize()` on a hidden window shows it,
   and a blank window would flash. That first show happens at
   `ready-to-show` or the main frame's `did-finish-load`, whichever comes
   first (`services/main-window-first-show.ts`): on Linux a hidden window
   whose startup scripts ran before its first frame gets the next one about
   a second later, so `ready-to-show` alone left the window off screen and
   the splash's animation frame waiting. At `did-finish-load` the inline
   splash is parsed, and the window's `backgroundColor` is the splash colour
   (`MAIN_WINDOW_BACKGROUND_COLOR`, keep it in sync with `#initial-splash`
   in `apps/web/src/index.html`), so showing before the first paint does
   not flash.
4. `iptvnator --fullscreen` (read via `app.commandLine.hasSwitch`, so it can
   sit anywhere in argv; the playlist-path extractor already skips every
   `-`-prefixed argument) forces `fullscreen` for that launch only and is
   never persisted. Resolution lives in
   `apps/electron-backend/src/app/services/startup-window-mode.ts`. The
   switch is consumed by the first window (`launchFullscreenSwitchConsumed`
   in `App`): on macOS the process outlives its last window and the Dock
   re-creates it through the same `initMainWindow`, which must then follow
   the stored setting only. A second-instance launch carrying the switch is
   ignored — the window already exists.
5. Deliberately not offered: kiosk mode (removes the exit path) and
   "remember last state" (bounds persistence stores normal bounds only; an
   explicit choice is clearer). Regression coverage: `app.spec.ts`
   ("startup window mode"), `settings.events.spec.ts`,
   `window.events.spec.ts`, and the startup-window-mode cases in
   `settings.e2e.ts`.

Zoom level (Cmd/Ctrl and +/−/0, issue #1109):

1. The packaged renderer runs under `file://` with path routing. Chromium
   keys per-host zoom by the FULL URL when a URL has no host, so every
   `pushState` to another section owns a separate zoom entry: after a route
   change `webContents.getZoomLevel()` already reports that entry (usually
   0) and the next visual-properties sync — a window resize, a display
   change — snaps the renderer back to it. Chromium persists those per-URL
   entries in `Preferences` on its own, which is why the level used to
   "appear briefly" on `index.html` at startup and then reset. Dev mode
   (`http://localhost:4200`) is per-host and never shows this, so only a
   packaged or `ELECTRON_IS_DEV=0` run can verify zoom behaviour.
2. Restore therefore happens in the preload, not the main process:
   `applyPersistedZoomLevel` (`api/preload-zoom-level.ts`) asks for the
   stored level over the synchronous `WINDOW:GET_ZOOM_LEVEL` IPC at preload
   start and applies it with `webFrame.setZoomLevel`, which installs a
   TEMPORARY, frame-bound zoom level. It survives in-page navigation and
   resizes, the zoom shortcuts (point 4) step it through the same call, and
   `getZoomLevel()` reports it regardless of the route.
   `webContents.setZoomLevel` from the main process would write the per-URL
   entry and re-create the bug. When nothing is stored the preload re-applies
   the current level for the same reason: entering temporary mode makes the
   first zoom shortcut URL-independent too. A failed request is swallowed
   and only costs this load its restore.
   The apply is deferred to `DOMContentLoaded` — never at preload start and
   never from a `setTimeout`: on Linux and Windows a `webFrame.setZoomLevel`
   that early leaves the hidden window without a first frame, `ready-to-show`
   never fires, `show()` never runs, and the renderer gets no animation
   frames (the splash `main.ts` removes in a `requestAnimationFrame` stays).
   macOS is unaffected and CDP-driven tests force frames, so only the
   packaged Linux/Windows E2E asserting the splash is gone caught it
   (`legacy-playlist-migration.e2e.ts`, defer-epg). After the parser
   finishes the call is harmless and still lands before the first Angular
   paint. The preload then sends `WINDOW:ZOOM_LEVEL_APPLIED`.
3. Chromium never persists temporary zoom, so `services/window-zoom-level.ts`
   owns the electron-conf key `ZOOM_LEVEL`: the applied acknowledgement (not
   the request — between the two the sender's `getZoomLevel()` is still the
   per-URL default) marks the sender
   as owning the level, `persistZoomLevel` writes it back from the window
   `close` and app `before-quit` handlers (the bounds-only saves of before,
   folded into `persistWindowState`), and `attachZoomLevelPersistence` also
   writes it on every main-frame cross-document `did-start-navigation` —
   a reload drops the temporary level, and by `did-finish-load` the new
   document's preload has already read whatever was stored. That
   navigation also releases ownership until the next preload answers, so a
   close mid-reload cannot save the per-URL default over the user's level.
4. The shortcuts are a renderer key binding, not a native menu: the
   Windows/Linux window calls `setMenu(null)`, so no accelerator could reach
   it there. `WorkspaceKeyboardShortcutsService` (`libs/workspace/shell`)
   listens on the document like it does for F11 and resolves the chord with
   `resolveZoomShortcutAction` (`libs/portal/shared/util`): Cmd on macOS,
   Ctrl elsewhere, never Alt; `+`/`=` (so `Ctrl+=` and `Ctrl+Shift+=` both
   zoom in), `-`/`_`, `0`, and the numpad `+`/`-`/`0` (by `code`, since a
   NumLock-off `0` reports `Insert`). Keys are matched by `event.key`, so
   non-US layouts zoom with their own `+`/`-` keys. Like F11 it is not gated
   by the typing-target check — browsers zoom from any focus — and a key
   another handler already `preventDefault`ed is left alone. The binding
   calls the synchronous, preload-local `window.electron.adjustZoomLevel`
   (`adjustFrameZoomLevel` in `api/preload-zoom-level.ts`), which steps the
   frame's temporary level through the same `webFrame.setZoomLevel` as the
   restore and returns the level applied — never a main-process
   `webContents.setZoomLevel`, which would re-create the per-URL bug. The
   step and limits live in `libs/shared/interfaces/src/lib/zoom-level.util.ts`
   (`stepZoomLevel`): 0.5 per press, Electron's own `zoomIn`/`zoomOut` role
   step (≈10 %), clamped to levels −4…6 (≈48 %…299 %, inside Chromium's
   25–500 %), off-grid levels snapping to the next grid point in the pressed
   direction; `Ctrl/Cmd+0` returns to level 0. A stored level already
   outside the limits (the macOS menu roles never clamped) is never moved
   against the request: a press further out leaves it, a press back in
   lands on the limit. Persistence needs nothing
   extra: the main process reads the live level back (point 3). On macOS the
   default application menu still carries the `zoomIn`/`zoomOut`/`resetZoom`
   roles, but Chromium hands a key equivalent to the web contents first and
   Electron performs the menu equivalent only in
   `WebContents::PlatformHandleKeyboardEvent`
   (`shell/browser/api/electron_api_web_contents_mac.mm`, Electron 43.3.0),
   the unhandled-keyboard-event hook — a `preventDefault`ed keydown never
   gets there, so the binding keeps one press at one step. CDP-dispatched
   keys (the E2E) never reach the menu at all.
   Without a bridge (PWA) the browser keeps its own zoom, and the help
   dialog lists the chords as Electron-only. Regression coverage:
   `window-zoom-level.e2e.ts` presses the real shortcuts (in, out, numpad,
   reset) and measures the rendered factor (content width ÷
   `window.innerWidth`) across a section change, a resize, a reload and a
   restart; key resolution and the bridge step are unit-tested in
   `keyboard-shortcuts.spec.ts`, `workspace-keyboard-shortcuts.service.spec.ts`
   and `preload-zoom-level.spec.ts`.
5. TiagoTV's default UI scale: the redesign uses the design handoff's
   sizes 1:1, but the user approved the prototype seen at `zoom: .8`, so
   every redesigned screen came out 1.25× too big. Rather than shrink each
   page, the Electron build starts at level −1 (≈83 %, two steps out) for a
   user who never changed the zoom. `provideDefaultUiScale`
   (`libs/workspace/shell/util/src/lib/default-ui-scale.ts`, registered in
   `apps/web/src/app/app.config.ts`; the util library because the shell
   feature is lazy-loaded and may not be imported statically) runs once
   the document is parsed — after the
   preload's `DOMContentLoaded` restore, so it sees the stored level — and
   goes through `window.electron.adjustZoomLevel`, so the level persists
   exactly like a shortcut press (point 3). The bridge has no getter: one
   step out that lands on −0.5 means the level was 0, and a second step
   makes it −1; any other answer is undone with a step in (except a probe
   that lands on the minimum, which may not have moved). The
   `tiagotv:ui-scale-default:v1` localStorage flag is written before the
   probe, so it runs once ever and never undoes a later `Cmd/Ctrl+0`;
   without storage for the flag, or without the bridge (PWA), it does
   nothing. Unit-tested with a fake bridge in `default-ui-scale.spec.ts`.

Reloading the renderer on an in-app route:

1. The packaged renderer is `dist/apps/web/index.html` over `file://` and
   Angular routes by path (no hash strategy), so once the user is on a
   section the document URL is `file:///…/web/workspace/sources` — a path
   with no file behind it. A reload of that URL fails with
   `ERR_FILE_NOT_FOUND` (-6) or is cancelled outright, depending on who
   starts it. Two user-reachable triggers: the macOS default application
   menu (nothing calls `Menu.setApplicationMenu`, so View › Reload / Force
   Reload are live; Windows/Linux drop the menu bar via `setMenu(null)`),
   and the settings unsaved-changes guard, which calls
   `window.location.reload()` after the user confirms a reload intent on
   `/workspace/settings/<section>`. Dev mode (`http://localhost:4200`) never
   shows either — the dev server serves the index for every path.
2. Both legs live in `services/renderer-reload-fallback.ts` and end in the
   same `restoreRendererRoute`: load the packaged index with the routed
   URL's route — its path relative to the renderer root plus query and
   fragment (`resolveRoutedRendererUrl`) — in the `restoreRoute` query
   parameter.
    - A main-process reload (`webContents.reload()`, the menu role,
      DevTools) fires no `will-navigate`, so it cannot be redirected up
      front: it fails, Chromium commits `chrome-error://chromewebdata/`
      and `app-root` stays empty until the app restarts.
      `attachRendererReloadFallback` recovers it after the fact from the
      main-frame `did-fail-load` with `ERR_FILE_NOT_FOUND`
      (`resolveReloadedRendererRoute`); other error codes, subframes and
      non-`file:` URLs are left alone. The recovery load is deferred to
      the error page's `dom-ready` and never issued from inside
      `did-fail-load`: a `loadFile` started while Chromium is still
      committing the error page yields a document that never receives
      animation frames — the splash stays, nothing paints, while
      `document.visibilityState` still says `visible` — and the same load
      after `dom-ready` paints normally (Electron emits `did-fail-load`
      before that `dom-ready`). A cross-document navigation starting in
      between withdraws the pending recovery, so a stale `dom-ready` can
      never re-load the index over a newer navigation.
    - A renderer-initiated reload (`location.reload()`, the settings
      guard) does fire `will-navigate`, where the routed URL is not the
      trusted index and `handleRendererNavigation` would cancel it —
      silently, so the confirmed reload simply never happened. The handler
      now recognizes a routed renderer URL and sends it straight to the
      index with its route, with no failed load in between; every other
      untrusted navigation is still blocked (external URLs still open in
      the browser).
   A failed `index.html` itself is never re-requested (it would loop):
   `resolveRoutedRendererUrl` rejects the index, and the recovery load
   carries `index.html` as its path, so a second failure cannot recurse.
3. The renderer consumes the parameter before Angular bootstraps:
   `apps/web/src/main.ts` calls `resolveRestoredRendererRoute`
   (`libs/shared/interfaces/src/lib/renderer-reload-route.util.ts`, which
   also owns the parameter name) and installs the result with
   `history.replaceState`, so the router's initial navigation lands on the
   route the user was on. The route is resolved against `document.baseURI`
   (the packaged `<base href="./">`, i.e. the renderer directory — the same
   prefix Angular strips from `location.pathname`), and anything that would
   leave that directory (an absolute URL, another scheme, a `..` escape)
   is dropped with only the parameter removed, so the app boots at its
   default route instead of following an arbitrary target.
4. Zoom persistence is unaffected: the failed reload's
   `did-start-navigation` already saved the level and released ownership,
   the recovery load's `did-start-navigation` is then a no-op, and the new
   document's preload restores the level as after any other reload. The
   main-process close guard also treats the recovery like any full
   navigation (`did-navigate` disarms it).
5. Regression coverage: `renderer-reload.e2e.ts` reloads from the main
   process (`webContents.reload()`, the menu role) on Sources and from the
   renderer (`window.location.reload()`, the settings guard) on a settings
   section and asserts a NEW document is rendered on the same route with
   the parameter gone (`renderer-reload.support.ts` marks the old document,
   since the URL alone is identical before and after);
   `window-zoom-level.e2e.ts` reloads the same way. Unit coverage:
   `renderer-reload-fallback.spec.ts`, `renderer-reload-route.util.spec.ts`,
   `app.spec.ts` ("renderer reload recovery").

Layout integration:

1. `document.body` gets a `frameless-platform` class (set in
   `AppComponent`, same mechanism as `dark-theme`) — body-level so rules
   also reach cdk-overlay content rendered outside `app-root`.
2. `apps/web/src/styles.scss` reserves `padding-right: 150px` in
   the top-aligned drag region (`.workspace-header`) for the 3 × 46px
   button strip.
3. Button colors follow the theme via CSS variables (`--app-on-surface`,
   `--app-hover-overlay`); the close button uses the Windows-style red
   hover (`#e81123`). No theme IPC is involved.

Window decorations on Linux (shadows, corners):

1. Hiding the title bar removes the window manager's decorations, so the
   shadow/rounded corners must come from client-side decorations (CSD).
   Electron 43 enables rounded corners by default when the Linux desktop
   environment supports CSD. GTK drop shadows and extended resize boundaries
   remain environment-dependent; Electron selects native Wayland automatically
   on Wayland sessions.
2. Linux environments without CSD support can still show a square,
   undecorated window. Windows 11 keeps its DWM rounded corners and shadow
   because the standard frame is retained.

Toolchain notes for the Electron 43 baseline:

1. `better-sqlite3` remains pinned exactly so native dependency updates happen
   deliberately with database-worker, packaging, and Electron E2E validation.
   Version 13 uses Node-API and ships its supported platform binaries in the
   package. It must not be listed in pnpm's `onlyBuiltDependencies`: forcing an
   implicit `node-gyp rebuild` bypasses those binaries and makes installation
   depend on the host compiler toolchain. The old `node-abi` override belonged
   to v12's removed `prebuild-install` path and is no longer required.
2. Local development supports **Node 22.22.3–22.x or 24.15.0–24.x**, declared in
   `engines` as `^22.22.3 || ^24.15.0`. Use `.nvmrc` (currently 22.23.2) for
   development and CI. Angular 22 sets this supported LTS range and requires
   TypeScript `>=6.0 <6.1`. `electron-builder` 26.15.7 also pulls `@electron/rebuild` 4,
   which requires Node 22.12 or newer, and the root `postinstall` runs
   `install-app-deps` on every `pnpm install`. The 26.15.7 minimum also
   carries the v26 backport that fully extracts the Snap template's `.tar.7z`
   payload; 26.15.0–26.15.6 can
   produce a Snap that is missing `desktop-init.sh`.
3. Dependabot keeps Electron, native database, packaging, EPG parser, and
   version-locked Shaka/mpegts updates out of the shared npm minor/patch group.
   Those dependencies require standalone PRs so their dedicated package,
   worker, playback, and diagnostic-contract validation cannot be hidden by an
   unrelated grouped update.
   Electron majors are ignored: Electron 44 ships no `linux-armv7l` binary,
   and the release still packages armv7l AppImage, DEB and Snap builds. Remove
   the ignore together with those targets when 32-bit ARM support is dropped.
4. Electron 42 and newer download their development binary on the first
   Electron command instead of during package `postinstall`, so `electron`
   must not remain in pnpm's `onlyBuiltDependencies` allowlist. The first local
   `pnpm run serve:backend` can include a one-time download; use `pnpm exec
electron --version` to prewarm it before an offline run.

Known caveats:

1. DIY buttons cannot show the Windows 11 Snap Layouts flyout (only native
   caption buttons or the Window Controls Overlay get that).
2. Double-click-to-maximize on drag regions is handled natively by
   Electron/Chromium; on Linux the exact behavior depends on the window
   manager.

## Maintenance Guidance

Use this document as the source of truth when changing workspace shell behavior.

1. New top-level user destinations should default to child routes under
   `/workspace`.
2. Shared provider navigation logic belongs in portal-shared util/UI libraries,
   not duplicated inside the shell.
3. If a provider route changes how playlist/session bootstrap works, update the
   route-session provider and shell-facing route contract together.
4. When adding a non-native keyboard shortcut, update the shared shortcuts
   registry, the help dialog tests, README, and the closest behavior test.
5. Historical migration notes, cleanup lists, and one-off refactor steps should
   stay out of this file; track them in issues or PR notes instead.
