/**
 * TiagoTV window chrome, as classes on <html>:
 *
 * - `native-glass`: the macOS app window is native glass (vibrancy, see the
 *   electron-backend's native-glass-window), so the page paints no backdrop
 *   of its own and the glass window fills the native one, whose corners
 *   macOS rounds.
 * - `window-fullscreen`: the window covers the whole screen, so the glass
 *   window loses its inset and rounded corners.
 */
export function startWindowChrome(doc: Document, nativeGlass: boolean): void {
    const root = doc.documentElement;
    root.classList.toggle('native-glass', nativeGlass);

    const view = doc.defaultView;
    if (!view) {
        return;
    }
    const sync = () =>
        root.classList.toggle('window-fullscreen', isFullscreenWindow(view));
    view.addEventListener('resize', sync);
    sync();
}

/**
 * The window, not an element, fills the screen: the window and screen sizes
 * are both in window points, so app zoom does not affect the comparison.
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
