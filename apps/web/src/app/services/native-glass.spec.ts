import type { ElectronBridgeWindowState } from '@iptvnator/shared/interfaces';
import {
    FULLSCREEN_SETTLE_MS,
    isFullscreenWindow,
    startWindowChrome,
} from './native-glass';

function view(outerWidth: number, outerHeight: number) {
    return {
        outerWidth,
        outerHeight,
        screen: { width: 1512, height: 982 } as Screen,
    };
}

/** A window that can resize, and a document whose view it is. */
function createWindow(width = 1200, height = 800) {
    const win = Object.assign(new EventTarget(), view(width, height));
    const doc = {
        documentElement: document.documentElement,
        defaultView: win,
    } as unknown as Document;
    const resize = (outerWidth: number, outerHeight: number) => {
        Object.assign(win, view(outerWidth, outerHeight));
        win.dispatchEvent(new Event('resize'));
    };
    return { doc, resize };
}

const isMarkedFullScreen = () =>
    document.documentElement.classList.contains('window-fullscreen');

function windowState(isFullScreen: boolean): ElectronBridgeWindowState {
    return { isMaximized: false, isFullScreen };
}

describe('window chrome', () => {
    afterEach(() => {
        document.documentElement.classList.remove(
            'native-glass',
            'window-fullscreen'
        );
        jest.useRealTimers();
    });

    it('is fullscreen only when the window covers the whole screen', () => {
        expect(isFullscreenWindow(view(1512, 982))).toBe(true);
        // Zoomed (maximized) under the menu bar is not fullscreen.
        expect(isFullscreenWindow(view(1512, 949))).toBe(false);
        expect(isFullscreenWindow(view(1200, 800))).toBe(false);
    });

    it('marks native glass and follows the window size without a bridge', () => {
        const { doc, resize } = createWindow();

        startWindowChrome(doc, { nativeGlass: true });
        expect(
            document.documentElement.classList.contains('native-glass')
        ).toBe(true);
        expect(isMarkedFullScreen()).toBe(false);

        resize(1512, 982);
        expect(isMarkedFullScreen()).toBe(true);
    });

    describe('with fullscreen events from the main process', () => {
        it('follows the pushed state, not the window size', () => {
            // A notched Mac: fullscreen sits below the notch, 1512 × 945 on
            // a 1512 × 982 screen, the size of a zoomed window.
            const { doc, resize } = createWindow(1512, 945);
            let push: (isFullScreen: boolean) => void = () => undefined;
            const onWindowFullScreenChange = jest.fn(
                (callback: (isFullScreen: boolean) => void) => {
                    push = callback;
                    return () => undefined;
                }
            );

            startWindowChrome(doc, {
                nativeGlass: true,
                fullScreenSource: 'events',
                bridge: { onWindowFullScreenChange },
            });
            expect(onWindowFullScreenChange).toHaveBeenCalledTimes(1);
            expect(isMarkedFullScreen()).toBe(false);

            push(true);
            expect(isMarkedFullScreen()).toBe(true);

            // A screen-sized window is no reason to guess otherwise.
            push(false);
            resize(1512, 982);
            expect(isMarkedFullScreen()).toBe(false);
        });

        it('takes the state the preload already holds', () => {
            const { doc } = createWindow();

            startWindowChrome(doc, {
                nativeGlass: true,
                fullScreenSource: 'events',
                bridge: {
                    onWindowFullScreenChange: (callback) => {
                        callback(true);
                        return () => undefined;
                    },
                },
            });

            expect(isMarkedFullScreen()).toBe(true);
        });

        it('falls back to the window size when the bridge lacks them', () => {
            const { doc, resize } = createWindow();

            startWindowChrome(doc, {
                nativeGlass: false,
                fullScreenSource: 'events',
                bridge: {},
            });
            resize(1512, 982);

            expect(isMarkedFullScreen()).toBe(true);
        });
    });

    describe('with an older macOS main process that only answers queries', () => {
        function startQueried(getWindowState: jest.Mock) {
            const win = createWindow(1512, 945);
            startWindowChrome(win.doc, {
                nativeGlass: true,
                fullScreenSource: 'query',
                bridge: { getWindowState },
            });
            return win;
        }

        it('asks at start and again after the window resizes', async () => {
            jest.useFakeTimers();
            const getWindowState = jest
                .fn()
                .mockResolvedValueOnce(windowState(false))
                .mockResolvedValue(windowState(true));

            const { resize } = startQueried(getWindowState);
            await jest.advanceTimersByTimeAsync(0);
            expect(getWindowState).toHaveBeenCalledTimes(1);
            expect(isMarkedFullScreen()).toBe(false);

            // Entering fullscreen below the notch: same size as zoomed.
            resize(1512, 945);
            await jest.advanceTimersByTimeAsync(0);
            expect(getWindowState).toHaveBeenCalledTimes(2);
            expect(isMarkedFullScreen()).toBe(true);
        });

        it('asks once more when the resizes have settled', async () => {
            jest.useFakeTimers();
            // The window still reports fullscreen at the leave transition's
            // resize and only afterwards the windowed state.
            const getWindowState = jest
                .fn()
                .mockResolvedValueOnce(windowState(true))
                .mockResolvedValueOnce(windowState(true))
                .mockResolvedValue(windowState(false));

            const { resize } = startQueried(getWindowState);
            await jest.advanceTimersByTimeAsync(0);
            resize(1200, 800);
            await jest.advanceTimersByTimeAsync(0);
            expect(isMarkedFullScreen()).toBe(true);

            await jest.advanceTimersByTimeAsync(FULLSCREEN_SETTLE_MS);
            expect(getWindowState).toHaveBeenCalledTimes(3);
            expect(isMarkedFullScreen()).toBe(false);
        });

        it('keeps one read in flight and reads again after a burst of resizes', async () => {
            jest.useFakeTimers();
            const answers: Array<(state: ElectronBridgeWindowState) => void> =
                [];
            const getWindowState = jest.fn(
                () =>
                    new Promise<ElectronBridgeWindowState>((resolve) =>
                        answers.push(resolve)
                    )
            );

            const { resize } = startQueried(getWindowState);
            resize(1300, 850);
            resize(1400, 900);
            expect(getWindowState).toHaveBeenCalledTimes(1);

            answers[0](windowState(false));
            await jest.advanceTimersByTimeAsync(0);
            // One more read covers both resizes.
            expect(getWindowState).toHaveBeenCalledTimes(2);

            answers[1](windowState(true));
            await jest.advanceTimersByTimeAsync(0);
            expect(isMarkedFullScreen()).toBe(true);
            expect(getWindowState).toHaveBeenCalledTimes(2);
        });

        it('keeps the last known state when a read fails', async () => {
            jest.useFakeTimers();
            const getWindowState = jest
                .fn()
                .mockResolvedValueOnce(windowState(true))
                .mockRejectedValueOnce(new Error('window closed'))
                .mockResolvedValue(undefined);

            const { resize } = startQueried(getWindowState);
            await jest.advanceTimersByTimeAsync(0);
            resize(1512, 982);
            await jest.advanceTimersByTimeAsync(FULLSCREEN_SETTLE_MS);

            expect(getWindowState).toHaveBeenCalledTimes(3);
            expect(isMarkedFullScreen()).toBe(true);
        });
    });
});
