import type { Page } from '@playwright/test';
import {
    closeElectronApp,
    expect,
    launchElectronApp,
    LaunchedElectronApp,
    test,
} from './electron-test-fixtures';
import {
    expectRendererReloadedOnRoute,
    reloadFromMainProcess,
} from './renderer-reload.support';

/**
 * The main process tells the renderer whether the window is fullscreen
 * (`window-fullscreen` on <html>, which drops the window's insets, bands
 * and corners) on every platform. The window's size cannot tell: a notched
 * Mac's fullscreen window sits below the notch, as large as a zoomed one.
 *
 * Most cases emit the window's fullscreen events themselves, as the OS
 * would: xvfb on Linux CI has no window manager to take a window
 * fullscreen. The window keeps its size, so a mark that follows proves it
 * came from the main process.
 */

const isWindowManagerlessCi =
    process.platform === 'linux' && !!process.env['CI'];

function isMarkedFullScreen(page: Page): Promise<boolean> {
    return page.evaluate(() =>
        document.documentElement.classList.contains('window-fullscreen')
    );
}

function emitWindowEvent(
    app: LaunchedElectronApp,
    eventName: 'enter-full-screen' | 'leave-full-screen'
): Promise<void> {
    return app.electronApp.evaluate(({ BrowserWindow }, name) => {
        BrowserWindow.getAllWindows()[0]?.emit(name);
    }, eventName);
}

/** The macOS traffic-light clearance the shell publishes. */
function lightsClearance(page: Page): Promise<string> {
    return page
        .locator('.workspace-shell')
        .evaluate((shell) =>
            (shell as HTMLElement).style.getPropertyValue(
                '--traffic-lights-clear-x'
            )
        );
}

test.describe('Window fullscreen mark', () => {
    test('@electron @window follows the fullscreen events, not the window size', async ({
        dataDir,
    }) => {
        const app = await launchElectronApp(dataDir);

        try {
            const page = app.mainWindow;
            await expect.poll(() => isMarkedFullScreen(page)).toBe(false);

            await emitWindowEvent(app, 'enter-full-screen');
            await expect.poll(() => isMarkedFullScreen(page)).toBe(true);
            if (process.platform === 'darwin') {
                // Fullscreen hides the traffic lights.
                await expect.poll(() => lightsClearance(page)).toBe('0px');
            }

            await emitWindowEvent(app, 'leave-full-screen');
            await expect.poll(() => isMarkedFullScreen(page)).toBe(false);
            if (process.platform === 'darwin') {
                await expect.poll(() => lightsClearance(page)).not.toBe('0px');
            }
        } finally {
            await closeElectronApp(app);
        }
    });

    test('@electron @window keeps the fullscreen mark across a reload', async ({
        dataDir,
    }) => {
        const app = await launchElectronApp(dataDir);

        try {
            const page = app.mainWindow;
            const route = new URL(page.url()).pathname;
            await emitWindowEvent(app, 'enter-full-screen');
            await expect.poll(() => isMarkedFullScreen(page)).toBe(true);

            // The new document learns the state the window already had.
            await reloadFromMainProcess(app);
            await expectRendererReloadedOnRoute(page, /\/workspace\//);
            expect(new URL(page.url()).pathname).toBe(route);
            await expect.poll(() => isMarkedFullScreen(page)).toBe(true);

            await emitWindowEvent(app, 'leave-full-screen');
            await expect.poll(() => isMarkedFullScreen(page)).toBe(false);
        } finally {
            await closeElectronApp(app);
        }
    });

    test('@electron @window marks a window the OS takes fullscreen', async ({
        dataDir,
    }) => {
        test.skip(
            isWindowManagerlessCi,
            'xvfb on Linux CI has no window manager'
        );
        const app = await launchElectronApp(dataDir);

        try {
            const page = app.mainWindow;
            const setFullScreen = (fullScreen: boolean) =>
                app.electronApp.evaluate(({ BrowserWindow }, target) => {
                    BrowserWindow.getAllWindows()[0]?.setFullScreen(target);
                }, fullScreen);

            await setFullScreen(true);
            await expect
                .poll(() => isMarkedFullScreen(page), { timeout: 10_000 })
                .toBe(true);

            await setFullScreen(false);
            await expect
                .poll(() => isMarkedFullScreen(page), { timeout: 10_000 })
                .toBe(false);
        } finally {
            await closeElectronApp(app);
        }
    });
});
