type FullScreenListener = (isFullScreen: boolean) => void;

/**
 * The window's fullscreen state behind the bridge's
 * `onWindowFullScreenChange`.
 *
 * The main process pushes the window state (`WINDOW:STATE_CHANGED`) on
 * every fullscreen change and once more when each document is ready
 * (`dom-ready`, see `services/window-state-events.ts`). The feed starts
 * listening when the preload runs, before any page script, so it keeps
 * that state however late the renderer subscribes: a subscriber is called
 * at once with the latest state when there is one, then on every change.
 * Only a boolean `isFullScreen` crosses the bridge.
 */
export function createWindowFullScreenFeed(
    listenToWindowState: (onState: (state: unknown) => void) => void
): (listener: FullScreenListener) => () => void {
    const listeners = new Set<FullScreenListener>();
    let current: boolean | undefined;

    listenToWindowState((state) => {
        const isFullScreen = (state as { isFullScreen?: unknown } | null)
            ?.isFullScreen;
        if (typeof isFullScreen !== 'boolean' || isFullScreen === current) {
            return;
        }
        current = isFullScreen;
        listeners.forEach((listener) => listener(isFullScreen));
    });

    return (listener) => {
        listeners.add(listener);
        if (current !== undefined) {
            listener(current);
        }
        return () => {
            listeners.delete(listener);
        };
    };
}
