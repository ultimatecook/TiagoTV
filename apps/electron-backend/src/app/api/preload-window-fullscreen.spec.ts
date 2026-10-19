import { createWindowFullScreenFeed } from './preload-window-fullscreen';

function createFeed() {
    let deliver: (state: unknown) => void = () => undefined;
    const subscribe = createWindowFullScreenFeed((onState) => {
        deliver = onState;
    });
    return { subscribe, push: (state: unknown) => deliver(state) };
}

describe('createWindowFullScreenFeed', () => {
    it('hands a late subscriber the state pushed before it subscribed', () => {
        // The main process sends the state at dom-ready, usually before the
        // app has booted far enough to subscribe.
        const feed = createFeed();
        feed.push({ isMaximized: false, isFullScreen: true });

        const listener = jest.fn();
        feed.subscribe(listener);

        expect(listener.mock.calls).toEqual([[true]]);
    });

    it('waits for the first push when nothing is known yet', () => {
        const feed = createFeed();
        const listener = jest.fn();

        feed.subscribe(listener);
        expect(listener).not.toHaveBeenCalled();

        feed.push({ isMaximized: false, isFullScreen: false });
        expect(listener.mock.calls).toEqual([[false]]);
    });

    it('calls back on fullscreen changes only, with a boolean', () => {
        const feed = createFeed();
        const listener = jest.fn();
        feed.subscribe(listener);

        feed.push({ isMaximized: false, isFullScreen: true });
        // A maximize push carries the same fullscreen state.
        feed.push({ isMaximized: true, isFullScreen: true });
        feed.push({ isMaximized: true, isFullScreen: false });

        expect(listener.mock.calls).toEqual([[true], [false]]);
    });

    it('ignores malformed pushes', () => {
        const feed = createFeed();
        const listener = jest.fn();
        feed.subscribe(listener);

        feed.push(undefined);
        feed.push(null);
        feed.push({ isFullScreen: 'yes' });

        expect(listener).not.toHaveBeenCalled();
    });

    it('stops calling an unsubscribed listener', () => {
        const feed = createFeed();
        const kept = jest.fn();
        const dropped = jest.fn();
        feed.subscribe(kept);
        const unsubscribe = feed.subscribe(dropped);

        unsubscribe();
        feed.push({ isMaximized: false, isFullScreen: true });

        expect(kept.mock.calls).toEqual([[true]]);
        expect(dropped).not.toHaveBeenCalled();
    });
});
