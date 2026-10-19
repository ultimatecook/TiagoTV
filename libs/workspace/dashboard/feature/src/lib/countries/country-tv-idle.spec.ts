import { OVERLAY_IDLE_MS, OverlayIdle, SETTLE_MS } from './country-tv-idle';

describe('OverlayIdle', () => {
    let canHide: boolean;
    let idle: OverlayIdle;

    beforeEach(() => {
        jest.useFakeTimers();
        canHide = true;
        idle = new OverlayIdle(() => canHide);
    });

    afterEach(() => {
        idle.destroy();
        jest.useRealTimers();
    });

    it('goes after the quiet time while it may, and comes back on activity', () => {
        idle.update();
        jest.advanceTimersByTime(OVERLAY_IDLE_MS - 1);
        expect(idle.visible()).toBe(true);
        jest.advanceTimersByTime(1);
        expect(idle.visible()).toBe(false);

        idle.wake();
        expect(idle.visible()).toBe(true);
        jest.advanceTimersByTime(OVERLAY_IDLE_MS);
        expect(idle.visible()).toBe(false);
    });

    it('restarts the quiet time on each activity', () => {
        idle.wake();
        jest.advanceTimersByTime(OVERLAY_IDLE_MS - 100);
        idle.wake();
        jest.advanceTimersByTime(OVERLAY_IDLE_MS - 100);
        expect(idle.visible()).toBe(true);
    });

    it('stays while it may not go (nothing plays, focus is inside)', () => {
        canHide = false;
        idle.update();
        jest.advanceTimersByTime(OVERLAY_IDLE_MS * 3);
        expect(idle.visible()).toBe(true);
        idle.hide();
        expect(idle.visible()).toBe(true);

        canHide = true;
        idle.update();
        jest.advanceTimersByTime(OVERLAY_IDLE_MS);
        expect(idle.visible()).toBe(false);

        // Focus went in: back on screen at once.
        canHide = false;
        idle.update();
        expect(idle.visible()).toBe(true);
    });

    it('goes at once on Esc, and a mouse move just after keeps it away', () => {
        idle.wake();
        idle.hide();
        expect(idle.visible()).toBe(false);

        idle.nudge();
        expect(idle.visible()).toBe(false);
        jest.advanceTimersByTime(SETTLE_MS);
        idle.nudge();
        expect(idle.visible()).toBe(true);
    });
});
