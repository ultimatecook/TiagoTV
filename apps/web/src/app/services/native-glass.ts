import type { WindowFullScreenSource } from '@iptvnator/services';
import type { ElectronBridgeApi } from '@iptvnator/shared/interfaces';

/**
 * After a resize, the window's state is read again this long later: the
 * last resize of a macOS fullscreen transition can come before the window
 * reports its new state, and the animation is over well within this.
 */
export const FULLSCREEN_SETTLE_MS = 1000;

type WindowStateBridge = Partial<
    Pick<ElectronBridgeApi, 'getWindowState' | 'onWindowFullScreenChange'>
>;

export interface WindowChromeOptions {
    /** The macOS window is native glass. */
    readonly nativeGlass: boolean;
    /** `RuntimeCapabilitiesService.windowFullScreenSource`. */
    readonly fullScreenSource?: WindowFullScreenSource;
    readonly bridge?: WindowStateBridge;
}

/**
 * TiagoTV window chrome, as classes on <html>:
 *
 * - `native-glass`: the macOS app window is native glass (vibrancy, see the
 *   electron-backend's native-glass-window), so the page paints no backdrop
 *   of its own and the glass window fills the native one, whose corners
 *   macOS rounds.
 * - `window-fullscreen`: the window is fullscreen, so the glass window
 *   loses its inset and rounded corners, and the traffic lights are hidden.
 *   Taken from the main process where it says (`events`, or `query` on an
 *   older macOS main process); otherwise from the window's size.
 */
export function startWindowChrome(
    doc: Document,
    options: WindowChromeOptions
): void {
    const root = doc.documentElement;
    root.classList.toggle('native-glass', options.nativeGlass);

    const show = (fullScreen: boolean) =>
        root.classList.toggle('window-fullscreen', fullScreen);
    const { bridge, fullScreenSource } = options;
    const view = doc.defaultView;

    if (fullScreenSource === 'events' && bridge?.onWindowFullScreenChange) {
        // App-lifetime: never unsubscribed.
        bridge.onWindowFullScreenChange(show);
        return;
    }
    if (!view) {
        return;
    }
    if (fullScreenSource === 'query' && bridge?.getWindowState) {
        followQueriedFullScreen(view, bridge.getWindowState, show);
        return;
    }

    const sync = () => show(isFullscreenWindow(view));
    view.addEventListener('resize', sync);
    sync();
}

/**
 * For a main process that answers the window state but does not push it:
 * asks now, after every resize (a fullscreen transition resizes the
 * window) and once more when the resizes have settled. One read is in
 * flight at a time; resizes meanwhile queue a single further read, so the
 * last answer always follows the last resize.
 */
function followQueriedFullScreen(
    view: Window,
    getWindowState: NonNullable<WindowStateBridge['getWindowState']>,
    show: (fullScreen: boolean) => void
): void {
    let reading = false;
    let readAgain = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const read = (): void => {
        if (reading) {
            readAgain = true;
            return;
        }
        reading = true;
        getWindowState()
            .then((state) => {
                if (typeof state?.isFullScreen === 'boolean') {
                    show(state.isFullScreen);
                }
            })
            .catch(() => undefined)
            .then(() => {
                reading = false;
                if (readAgain) {
                    readAgain = false;
                    read();
                }
            });
    };

    view.addEventListener('resize', () => {
        read();
        clearTimeout(settleTimer);
        settleTimer = setTimeout(read, FULLSCREEN_SETTLE_MS);
    });
    read();
}

/**
 * The window, not an element, fills the screen: the window and screen sizes
 * are both in window points, so app zoom does not affect the comparison.
 * Misses a notched Mac's fullscreen window, which sits below the notch.
 */
export function isFullscreenWindow(
    view: Pick<Window, 'outerWidth' | 'outerHeight' | 'screen'>
): boolean {
    const { width, height } = view.screen;
    return (
        width > 0 &&
        height > 0 &&
        view.outerWidth >= width &&
        view.outerHeight >= height
    );
}
