import {
    ElectronBridgeWindowState,
    WINDOW_STATE_CHANGED,
} from '@iptvnator/shared/interfaces';

/**
 * Pushes the window's maximize and fullscreen state to its renderer
 * (`WINDOW:STATE_CHANGED`) on every platform. Windows/Linux draw their own
 * window controls from it; every renderer marks a fullscreen window on
 * `<html>` (`window-fullscreen`) to drop the window's insets, bands and
 * corners. macOS needs the push as much: a fullscreen window on a notched
 * Mac sits below the notch, so the renderer cannot tell it from a zoomed
 * window by its size.
 *
 * Window state is never re-read at event time: on Windows both
 * isFullScreen() and isMaximized() can still report the pre-transition
 * value while the matching event fires (notably for HTML-element
 * fullscreen, i.e. the video player). Since the renderer replaces both flags
 * on every push and no later event corrects a stale one, polling left the
 * controls hidden forever after leaving fullscreen — and, for the companion
 * flag, the maximize/restore glyph stuck on the wrong icon. Instead the
 * state is seeded once here (window creation, so no transition is in
 * flight) and each event patches only the flag it names.
 *
 * The tracked state is sent again whenever a document is ready in the
 * window (`dom-ready`: the first load, every reload, an interface update
 * loading another build), so a new document learns a state that changed
 * before it existed, such as a fullscreen launch or a reload in
 * fullscreen. The preload listens from before the page's scripts run and
 * hands the latest state to later subscribers (`onWindowFullScreenChange`).
 */
export function attachWindowStateEvents(win: Electron.BrowserWindow): void {
    const state: ElectronBridgeWindowState = {
        isMaximized: win.isMaximized(),
        isFullScreen: win.isFullScreen(),
    };

    // Native (OS-level) and HTML-element fullscreen are tracked apart and
    // OR-ed into the pushed flag. Electron remembers when the window was
    // already natively fullscreen before the player entered HTML fullscreen
    // and then leaves ONLY the HTML state on exit — no 'leave-full-screen'
    // fires and the window stays fullscreen. A single flag cleared by
    // 'leave-html-full-screen' would un-hide the window controls over a
    // window that is still fullscreen, which a fullscreen launch or F11
    // followed by the player's F → Esc makes routine.
    const fullscreen = { native: state.isFullScreen, html: false };

    const push = (patch: Partial<ElectronBridgeWindowState>) => {
        Object.assign(state, patch);

        if (win.isDestroyed()) {
            return;
        }

        // A copy per push: the renderer must not observe later mutations
        // of the tracked state.
        win.webContents.send(WINDOW_STATE_CHANGED, { ...state });
    };
    const pushFullScreen = () =>
        push({ isFullScreen: fullscreen.native || fullscreen.html });

    win.on('maximize', () => push({ isMaximized: true }));
    win.on('unmaximize', () => push({ isMaximized: false }));
    // The html variants cover HTML-element fullscreen; not every
    // platform/trigger emits both pairs, and duplicate pushes with the same
    // payload are harmless.
    win.on('enter-full-screen', () => {
        fullscreen.native = true;
        pushFullScreen();
    });
    win.on('leave-full-screen', () => {
        fullscreen.native = false;
        pushFullScreen();
    });
    win.on('enter-html-full-screen', () => {
        fullscreen.html = true;
        pushFullScreen();
    });
    win.on('leave-html-full-screen', () => {
        fullscreen.html = false;
        pushFullScreen();
    });
    // Renderers built before the push reached macOS ignore it there: they
    // subscribe only for the Windows/Linux window controls.
    win.webContents.on('dom-ready', () => push({}));
}
