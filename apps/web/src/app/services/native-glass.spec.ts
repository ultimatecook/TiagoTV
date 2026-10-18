import { isFullscreenWindow, startWindowChrome } from './native-glass';

function view(outerWidth: number, outerHeight: number) {
    return {
        outerWidth,
        outerHeight,
        screen: { width: 1512, height: 982 } as Screen,
    };
}

describe('window chrome', () => {
    afterEach(() => {
        document.documentElement.classList.remove(
            'native-glass',
            'window-fullscreen'
        );
    });

    it('is fullscreen only when the window covers the whole screen', () => {
        expect(isFullscreenWindow(view(1512, 982))).toBe(true);
        // Zoomed (maximized) under the menu bar is not fullscreen.
        expect(isFullscreenWindow(view(1512, 949))).toBe(false);
        expect(isFullscreenWindow(view(1200, 800))).toBe(false);
    });

    it('marks native glass and follows the window into fullscreen', () => {
        const root = document.documentElement;
        const win = Object.assign(new EventTarget(), view(1200, 800));
        const doc = { documentElement: root, defaultView: win } as never;

        startWindowChrome(doc, true);
        expect(root.classList.contains('native-glass')).toBe(true);
        expect(root.classList.contains('window-fullscreen')).toBe(false);

        Object.assign(win, view(1512, 982));
        win.dispatchEvent(new Event('resize'));
        expect(root.classList.contains('window-fullscreen')).toBe(true);
    });
});
