# Handoff: "ultra clean" redesign (top bar) — state on 2026-10-19

Read this first if you take over the redesign. The design spec (the user's
handoff README, Spanish) is in
[2026-10-19-ultra-clean-redesign-spec.md](2026-10-19-ultra-clean-redesign-spec.md).
The HTML prototype itself is not in the repo.

## Working with this user

- Reply in rioplatense Spanish.
- Publishing = pushing to `main`. That triggers the over-the-air UI update
  (`.github/workflows/tiagotv-ui-update.yml`, ~1.5 min); the user gets it by
  quitting with Cmd+Q and reopening. A new macOS installer is a manual
  `workflow_dispatch` of `tiagotv-macos.yml` on `main` (~9 min).
- Never publish without the user's explicit OK, and send screenshots of every
  changed screen before asking ("mostrame cómo queda antes de publicar").
- No pull requests unless asked. Work on `preview/home-platforms`.
- Commits: author `Tiago Locatelli <tiago@rosariotexas.com>`, committer
  `Claude <noreply@anthropic.com>`:
  `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit --author="Tiago Locatelli <tiago@rosariotexas.com>"`.
  `main` history is conventional commits (`feat(scope): …`, `fix(scope): …`).
- Never commit, print or send the IPTV provider's credentials (server, user,
  password, MAC, device key), and never contact the provider or its logo hosts
  from a sandbox. Use local fake streams and fixture data for screenshots.
- `CLAUDE.md`: upstream release-note, release and external review-gate rules
  do not apply to this fork.

## Branch state

- Published: `main` was fast-forwarded to the redesign (`0b2c6c55d`) on
  2026-10-19 with the user's OK; the UI update run #19 succeeded.
- `preview/home-platforms` = `main` + 3 clean commits: `fix(playback)`
  (Video.js), `docs(plans)` (this file and the spec) and `feat(ui)` (the
  redesign). The WIP history is kept in the tag
  `backup/preview-before-squash-4`.
- Verified green on that tree: `typecheck:web`, `typecheck:backend`, lint +
  test of web, workspace-dashboard-feature, workspace-shell-feature,
  workspace-shell-util, shared-interfaces, ui-playback, services,
  portal-shared-ui and portal-shared-util, the 7 style checks, and
  `web:build:production`.

## What is built (all on the preview branch)

The spec's screens are implemented on real data. Every agent reported its
checks green except where noted under "Known issues".

| Area | Route | Main files |
| --- | --- | --- |
| Tokens | — | `apps/web/src/_tv-tokens.scss` (`--tv-*`, `tv-pulse`, `--tv-window-radius`) |
| Top bar (replaces the sidebar) | all | `libs/workspace/shell/feature/src/lib/workspace-shell/components/workspace-shell-top-bar/`, `workspace-top-bar-nav.ts`, `workspace-scroll-memory.ts` |
| Inicio | `/workspace/dashboard` | `libs/workspace/dashboard/feature/src/lib/rails/` (`dashboard-hero`, `platforms-rail`, `home-events`, `home-top-movies`, `home-series`, `home-recent-channels`) |
| Deportes hub | `/workspace/sports` | `…/lib/sports/ui/sports-hub-page.*`, `sports-rail.*`, `match-days.ts`, `my-teams.ts` |
| League page | `/workspace/sports/:sectionId` | `…/sports/ui/sport-section-page.*`, `sport-stage`, `sport-signal-card`, `featured-match`, `sport-match-row`, `league-table`, `sport-tv-playback.ts` |
| En vivo by country | `/workspace/countries[/:countryId]` | `…/lib/countries/` (`country-tv-*`, `ui/country-picker`, `ui/country-tv-overlay`, `ui/country-tv-cards`) |
| Series / Películas | `/workspace/series`, `/workspace/movies` | `…/lib/catalog/**` (`CatalogService`, `StoredVodCatalog`) |
| Buscar | `/workspace/search` | `…/lib/search/**` (recent searches in `tiagotv:recent-searches:v1`) |
| Ajustes | `/workspace/settings` | `apps/web/src/app/settings/settings-rail.component.*`, `settings.component.*`, `apps/web/src/_settings-theme.scss` |

Layout contract (the shell implements it, pages rely on it):

- The top bar is a transparent 84px band. The scroller
  (`main.workspace-content`) starts with an 84px spacer; content scrolls
  *under* the bar by design.
- Pages own their padding: `var(--tv-page-top) var(--tv-page-x) var(--tv-page-bottom)`.
- Heroes and full players bleed behind the bar with
  `margin-top: calc(-1 * var(--tv-topbar-h))` and round their top corners with
  `var(--tv-window-radius)`. That radius is 34px in the browser window and 0 in
  native glass, in fullscreen and at 640px and below.
- At 760px and below the bar has two rows: `--tv-topbar-h: 108px`,
  `--tv-page-x: 20px`.
- Framed pages (Xtream/Stalker lists with the category panel, portal title
  pages, M3U, sources, downloads) sit below the bar at full height.

Data notes:

- Sports standings come from ESPN's public API
  (`site.api.espn.com/apis/v2/sports/soccer/<slug>/standings`), falling back to
  TheSportsDB. The cache key is `tiagotv:league-tables:v2`.
- ESPN answers 403 to the `HeadlessChrome` user agent. Screenshot scripts must
  set a desktop Chrome UA; Electron is not affected.
- The provider allows ONE connection and is load-sensitive, so pages read the
  stored catalog: SQLite through the DB worker in Electron, the session cache in
  the browser.
- `MACOS_TRAFFIC_LIGHTS_POSITION` is now `{x:22, y:35}` (centred on the 84px
  bar). It takes effect only with a new installer; the renderer also clears the
  old `{16,20}` position.

## Finished after the first draft of this handoff

Both are on the preview branch.

1. **Done:** Home Top 10 / "Series para vos" read `catalog/CatalogService`
   (stored catalog first, at most 3 detail requests). On a first run with an
   empty store, CatalogService's own fallback loads every platform's lists one
   at a time (the old Home loaded only 3).
2. **Done:** the Video.js `setVolume` TypeError. The sandbox Chromium has no
   H.264, so mpegts.js is unsupported and no Video.js tech loads. Production
   Electron is not affected for TS; `.mkv` could hit it. Fixed in
   `vjs-player.component.ts` / `vjs-player.types.ts` (wait for a tech before
   setting the volume) with a regression spec. In screenshot scripts, stub
   `MediaSource.isTypeSupported` for avc1 to play TS.

## Remaining steps to finish

1. **Done** (see Branch state). To re-run it after changes:
   - `pnpm install --frozen-lockfile` (in a fresh checkout)
   - `pnpm -s run typecheck:web` and `typecheck:backend`
   - `NX_DAEMON=false pnpm nx run-many -t lint test -p web workspace-dashboard-feature workspace-shell-feature workspace-shell-util shared-interfaces ui-playback --skip-nx-cache`
     (check project names with `pnpm nx show projects`)
   - `pnpm -s run styles:{theme-references,font-weights,icon-ligatures,focus-visible,inputs,material-tokens,material-theme-scope}:check`
   - `NX_DAEMON=false pnpm nx run web:build:production --skip-nx-cache`

   Settings specs time out under heavy load; re-run them alone before calling
   that a failure.
2. **Done:** WIP commits squashed and the preview branch pushed.
3. Take 1600×1000 screenshots of every screen and send them to the user:
   - screens: Inicio, Deportes, a league page, En vivo, Series, Películas,
     Buscar, Ajustes, a title page;
   - modes: browser window, plus the glass/fullscreen variants;
   - setup: Playwright with Chromium at `/opt/pw-browsers` (never run
     `playwright install`), dev server `NX_DAEMON=false pnpm nx run web:serve`
     on :4200, fixture data intercepted in the browser, provider blocked.
   - The old screenshot scripts and catalog snapshot lived in the previous
     session's scratchpad; they are not in the repo.
4. **Done:** published with the user's OK (UI update run #19 green).
5. Offer a new installer, for the centred traffic lights.

## Known issues and open items

- **Stale E2E tests** that still target the old sidebar/rails:
  - `window-controls.e2e.ts` (macOS rail/header)
  - `dashboard-hero-legibility.e2e.ts` and the classic-rails dashboard E2Es
  - E2Es using the old settings links and the old global search

  Update them, or say they were not run and why.
- **Unused code:** `GlobalSearchResultsComponent` (no longer routed),
  `countries/ui/near-viewport.directive.ts`, the `WORKSPACE.SIDEBAR` i18n keys,
  and the old `workspace-shell-rail` / `rail-links` components. Delete or keep;
  this has not been decided.
- **`i18n:check`** fails fork-wide (only en/es are maintained). Three Spanish
  strings equal their English ones.
- **⌘K command palette:** pointer access is gone (the old chip); ⌘K still works.
- **Lint:** 4 warnings remain in `sports-catalog.ts` (old non-null assertions).
- **Missing data:** no scores or minutes anywhere (the provider has none);
  live-match state is not computed for `via` channels such as M+ LaLiga TV.

## Questions still open with the user

- Should Series/Películas also include kept-language titles that are on no
  platform?
- Should the app show an "account expired" banner?

## Not an app problem: the provider account

- The account-info screen reports an **expired one-day trial** (created
  18/10/2026, expired 19/10/2026, max 1 connection). That is why platforms,
  movies and live playback stopped loading for the user.
- The code reads those fields straight from the server, and that code was
  never modified.
- The user believes the line is annual. Their friend/provider has to convert
  the line, or the user enters new credentials in Ajustes → Fuentes y cuentas.

## Other backlog

- Movies audio: embedded MPV in the Mac installer (pending since before the
  redesign).
