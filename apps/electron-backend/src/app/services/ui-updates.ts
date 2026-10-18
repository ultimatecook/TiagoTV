import { execFile } from 'child_process';
import { app, net, Notification } from 'electron';
import { join } from 'path';
import { promisify } from 'util';
import {
    checkForUiUpdate,
    pruneUiBuilds,
    type UiUpdateOutcome,
} from './ui-update-download';
import {
    markUiBuildHealthy,
    newestUiBuild,
    readUiUpdateState,
    rejectUiBuild,
    selectRenderer,
    type RendererSelection,
} from './ui-update-state';

/**
 * TiagoTV over-the-air interface updates, wired to Electron. Only the
 * packaged macOS app takes them (the build that has a release feed).
 */

const CHECK_DELAY_MS = 20_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Time a new build gets to render the app before it counts as broken. */
const HEALTH_CHECK_DELAY_MS = 20_000;

const runExecFile = promisify(execFile);
let selection: RendererSelection | null = null;
let started = false;
let checking = false;

function updatesEnabled(): boolean {
    return app.isPackaged && process.platform === 'darwin';
}

function updatesRoot(): string {
    return join(app.getPath('userData'), 'ui-updates');
}

/**
 * The renderer index.html for this launch: the newest installed update, or
 * the packaged copy. Decided once per process, so the navigation guards and
 * reload fallbacks all follow the renderer that was actually loaded.
 */
export function packagedRendererIndexPath(bundledIndexPath: string): string {
    if (!selection) {
        selection = updatesEnabled()
            ? selectRenderer(updatesRoot(), bundledIndexPath)
            : { indexPath: bundledIndexPath, build: null };
    }
    return selection.indexPath;
}

/**
 * Once the main window is on screen: confirms a newly installed build
 * rendered the app (or falls back and relaunches), then checks for newer
 * builds now and then.
 */
export function startUiUpdates(
    win: Electron.BrowserWindow,
    bundledIndexPath: string
): void {
    if (started || !updatesEnabled()) {
        return;
    }
    started = true;
    const root = updatesRoot();
    const running = selection?.build ?? null;

    if (running !== null && !readUiUpdateState(root).installed?.verified) {
        setTimeout(
            () => void confirmHealthy(win, root, running),
            HEALTH_CHECK_DELAY_MS
        );
    }

    const check = async () => {
        if (checking) {
            return;
        }
        checking = true;
        try {
            const outcome = await checkForUiUpdate({
                root,
                newestBuild: newestUiBuild(root, bundledIndexPath),
                fetch: (url) => net.fetch(url, { cache: 'no-store' }),
                extract: (zip, destination) =>
                    runExecFile('/usr/bin/ditto', [
                        '-x',
                        '-k',
                        zip,
                        destination,
                    ]).then(() => undefined),
            });
            await pruneUiBuilds(root, [
                running,
                readUiUpdateState(root).installed?.build ?? null,
            ]);
            announce(outcome);
        } catch (error) {
            console.warn('[TiagoTV] Interface update check failed:', error);
        } finally {
            checking = false;
        }
    };
    setTimeout(() => void check(), CHECK_DELAY_MS);
    setInterval(() => void check(), CHECK_INTERVAL_MS);
}

async function confirmHealthy(
    win: Electron.BrowserWindow,
    root: string,
    build: number
): Promise<void> {
    if (win.isDestroyed()) {
        return;
    }
    const rendered = await win.webContents
        .executeJavaScript(
            "document.querySelector('app-root')?.childElementCount ?? 0"
        )
        .catch(() => 0);
    if (Number(rendered) > 0) {
        markUiBuildHealthy(root, build);
        return;
    }
    console.warn(
        `[TiagoTV] Interface build ${build} did not start; using the installed app's.`
    );
    rejectUiBuild(root, build);
    app.relaunch();
    app.quit();
}

function announce(outcome: UiUpdateOutcome): void {
    if (outcome !== 'installed' || !Notification.isSupported()) {
        return;
    }
    const notification = new Notification({
        title: 'TiagoTV',
        body: 'Hay una versión nueva lista. Tocá para reiniciar y usarla.',
    });
    notification.on('click', () => {
        app.relaunch();
        app.quit();
    });
    notification.show();
}
