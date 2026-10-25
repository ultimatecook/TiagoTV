import type { App } from './app';
import type { ScreenStack } from './core/screens';
import { CatalogCache } from './data/catalog-cache';
import { accountScope, CatalogPersist } from './data/catalog-persist';
import { CatalogStore } from './data/catalog-store';
import { SportsBoard } from './data/sports-board';
import { PlaybackController } from './player/controller';
import type { PlayerEngine } from './player/engine';
import { CatalogPage } from './screens/catalog-page';
import { DetailScreen } from './screens/detail';
import { HomePage } from './screens/home-page';
import { LeagueScreen } from './screens/league-screen';
import { LivePage } from './screens/live-page';
import { MyListPage } from './screens/mylist-page';
import { PlatformScreen } from './screens/platform-screen';
import { PlayerScreen } from './screens/player-screen';
import { SearchPage } from './screens/search-page';
import { SettingsPage } from './screens/settings-page';
import { ShellScreen, type PageDefinition } from './screens/shell';
import { SportsPage } from './screens/sports-page';
import type { XtreamClient } from './xtream/client';
import { loadPrefs, savePrefs } from './xtream/source';

/**
 * The app object the screens share (app.ts), and the shell's pages in
 * the bar's order.
 */
declare const __APP_VERSION__: string;

export interface WiringDeps {
    readonly stack: ScreenStack;
    readonly engine: PlayerEngine;
    readonly openSetup: () => void;
    readonly exit: () => void;
}

function localStore(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function pagesOf(app: App): PageDefinition[] {
    return [
        { id: 'home', create: () => new HomePage(app) },
        { id: 'sports', create: () => new SportsPage(app) },
        { id: 'series', create: () => new CatalogPage(app, 'series') },
        { id: 'movies', create: () => new CatalogPage(app, 'movie') },
        { id: 'live', create: () => new LivePage(app) },
        { id: 'mylist', create: () => new MyListPage(app) },
        { id: 'search', create: () => new SearchPage(app) },
        { id: 'settings', create: () => new SettingsPage(app) },
    ];
}

/** Builds the app for `client` and opens its shell on Inicio. */
export function startApp(client: XtreamClient, deps: WiringDeps): App {
    const { stack, engine } = deps;
    const scope = accountScope(client.credentials.server, client.credentials.username);
    const persist = new CatalogPersist(scope);
    const cache = new CatalogCache(client, persist);
    const store = new CatalogStore(cache, persist);
    const sports = new SportsBoard(cache, scope, localStore());
    let shell: ShellScreen | null = null;
    const app: App = {
        stack,
        client,
        cache,
        store,
        sports,
        engine,
        version: __APP_VERSION__,
        play: (request) => stack.push(new PlayerScreen(app, new PlaybackController(app, engine, request))),
        openTitle: (title, options) => stack.push(new DetailScreen(app, title, options ?? {})),
        openPlatform: (platformId) => stack.push(new PlatformScreen(app, platformId)),
        openLeague: (sectionId) => stack.push(new LeagueScreen(app, sectionId)),
        openTab: (id) => {
            while (stack.depth > 1) {
                stack.pop();
            }
            shell?.open(id);
        },
        setBarHidden: (hidden) => shell?.setBare(hidden),
        openSetup: deps.openSetup,
        prefs: () => loadPrefs(),
        setPrefs: (change) => {
            savePrefs(change);
        },
        exit: deps.exit,
        retryLoads: () => {
            cache.forget('country:');
            void store.retryFailed();
            sports.refresh(true).then(undefined, () => undefined);
        },
    };
    shell = new ShellScreen(pagesOf(app));
    stack.reset(shell);
    return app;
}
