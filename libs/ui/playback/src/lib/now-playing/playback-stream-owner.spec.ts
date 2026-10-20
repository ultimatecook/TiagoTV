import { TestBed } from '@angular/core/testing';
import { PlaybackStreamOwner } from './playback-stream-owner';

describe('PlaybackStreamOwner', () => {
    let streams: PlaybackStreamOwner;

    beforeEach(() => {
        streams = TestBed.inject(PlaybackStreamOwner);
    });

    afterEach(() => jest.useRealTimers());

    it('stops every other holder when one claims the stream', () => {
        const page = { stop: jest.fn() };
        const bar = { stop: jest.fn() };
        streams.claim(bar);
        expect(bar.stop).not.toHaveBeenCalled();

        streams.claim(page);

        expect(bar.stop).toHaveBeenCalledTimes(1);
        expect(page.stop).not.toHaveBeenCalled();
        // The claimant waits until the stopped holder let go.
        expect(streams.blocked(page)).toBe(true);
        expect(streams.blocked(bar)).toBe(true);

        streams.release(bar);
        expect(streams.blocked(page)).toBe(false);

        // Claiming again while holding stops nobody, itself included.
        streams.claim(page);
        expect(page.stop).not.toHaveBeenCalled();
        expect(bar.stop).toHaveBeenCalledTimes(1);
    });

    it('lets a holder join without stopping anyone, the others waiting', () => {
        const page = { stop: jest.fn() };
        const lateBar = { stop: jest.fn() };
        streams.claim(page);

        streams.hold(lateBar);

        expect(page.stop).not.toHaveBeenCalled();
        expect(streams.blocked(page)).toBe(true);
        streams.release(lateBar);
        expect(streams.blocked(page)).toBe(false);
    });

    it('holds starts back while a connection is still closing', async () => {
        const page = { stop: jest.fn() };
        streams.claim(page);
        let closed!: () => void;
        streams.closing(new Promise<void>((resolve) => (closed = resolve)));

        const ready = jest.fn();
        void streams.whenClosed().then(ready);
        expect(streams.blocked(page)).toBe(true);
        // Embedded MPV waits for closes itself.
        expect(streams.blocked(page, false)).toBe(false);

        await Promise.resolve();
        expect(ready).not.toHaveBeenCalled();

        closed();
        await Promise.resolve();
        await Promise.resolve();
        expect(ready).toHaveBeenCalledTimes(1);
        expect(streams.blocked(page)).toBe(false);
    });

    it('counts a failed close as closed', async () => {
        streams.closing(Promise.reject(new Error('session not found')));
        await expect(streams.whenClosed()).resolves.toBeUndefined();
    });

    it('does not wait for good on a close that never answers', async () => {
        jest.useFakeTimers();
        streams.closing(new Promise(() => undefined));
        const ready = jest.fn();
        void streams.whenClosed().then(ready);

        await jest.advanceTimersByTimeAsync(4999);
        expect(ready).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);
        expect(ready).toHaveBeenCalledTimes(1);
    });
});
