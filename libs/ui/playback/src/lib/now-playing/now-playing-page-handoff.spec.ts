import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NowPlayingDockService } from './now-playing-dock.service';
import {
    NowPlayingPageHandoff,
    type NowPlayingPageSnapshot,
} from './now-playing-page-handoff';

const SNAPSHOT: NowPlayingPageSnapshot = {
    streamUrl: 'http://portal.test/movie/u/p/1.mp4',
    sessionKey: 'session-1',
    playback: null,
    title: 'Black Harbor',
    subtitle: null,
    isLive: false,
    video: null,
    fallbackVolume: 1,
};

describe('NowPlayingPageHandoff', () => {
    const router = {
        url: '/workspace/xtreams/p1/vod/10/1',
        currentNavigation: signal<unknown>(null),
    };

    function create(dockable = true): NowPlayingPageHandoff {
        return TestBed.runInInjectionContext(
            () => new NowPlayingPageHandoff(() => dockable)
        );
    }

    /** The mini-player's own view: the bar holds the stream for it. */
    function createBarView(): NowPlayingPageHandoff {
        return TestBed.runInInjectionContext(
            () =>
                new NowPlayingPageHandoff(
                    () => false,
                    () => true
                )
        );
    }

    function handOver(): void {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });
        router.currentNavigation.set({ id: 2 });
        page.release(SNAPSHOT);
        router.currentNavigation.set(null);
    }

    beforeEach(() => {
        router.url = '/workspace/xtreams/p1/vod/10/1';
        router.currentNavigation.set(null);
        TestBed.configureTestingModule({
            providers: [{ provide: Router, useValue: router }],
        });
    });

    it('hands a playing stream over when the page is navigated away from', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });

        router.currentNavigation.set({ id: 2 });
        page.release(SNAPSHOT);

        expect(TestBed.inject(NowPlayingDockService).session()).toMatchObject({
            startTime: 42,
            returnUrl: '/workspace/xtreams/p1/vod/10/1',
        });
    });

    it("hands the viewer's saved level over when the engine reset its element", () => {
        localStorage.setItem('volume', '0.26');
        try {
            const page = create();
            page.record({ currentTime: 42, duration: 3600, playing: true });

            router.currentNavigation.set({ id: 2 });
            // Video.js already disposed: no element, the input's default 1.
            page.release({ ...SNAPSHOT, video: null, fallbackVolume: 1 });

            expect(
                TestBed.inject(NowPlayingDockService).session()
            ).toMatchObject({ volume: 0.26, muted: false });
        } finally {
            localStorage.removeItem('volume');
        }
    });

    it('hands the picture-in-picture state over with the stream', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });
        const video = document.createElement('video');
        document.body.appendChild(video);
        video.dispatchEvent(
            new Event('enterpictureinpicture', { bubbles: true })
        );

        router.currentNavigation.set({ id: 2 });
        page.release(SNAPSHOT);
        video.remove();

        expect(
            TestBed.inject(NowPlayingDockService).session()?.pictureInPicture
        ).toBe(true);
    });

    it('hands no picture-in-picture over once the picture left it', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });
        document.dispatchEvent(new Event('enterpictureinpicture'));
        document.dispatchEvent(new Event('leavepictureinpicture'));

        router.currentNavigation.set({ id: 2 });
        page.release(SNAPSHOT);

        expect(
            TestBed.inject(NowPlayingDockService).session()?.pictureInPicture
        ).toBeUndefined();
    });

    it('also hands over once the URL already moved on', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });

        router.url = '/workspace/dashboard';
        page.release(SNAPSHOT);

        expect(TestBed.inject(NowPlayingDockService).session()).not.toBeNull();
    });

    describe('with the Navigation API', () => {
        const entry = { key: 'list' };
        beforeEach(() =>
            Object.defineProperty(window, 'navigation', {
                configurable: true,
                value: { currentEntry: entry },
            })
        );
        afterEach(() => delete (window as { navigation?: unknown }).navigation);

        it('hands over when history leaves the entry it played on, URL unchanged', () => {
            // Mi lista's inline detail is a pushed entry of the list's URL;
            // Back to the list tears the player down with no route change.
            entry.key = 'detail';
            const page = create();
            page.record({ currentTime: 42, duration: 3600, playing: true });

            entry.key = 'list';
            page.release(SNAPSHOT);

            expect(
                TestBed.inject(NowPlayingDockService).session()
            ).not.toBeNull();
        });

        it('lets the stream stop when the page closes it on the same entry', () => {
            entry.key = 'detail';
            const page = create();
            page.record({ currentTime: 42, duration: 3600, playing: true });

            page.release(SNAPSHOT);

            expect(TestBed.inject(NowPlayingDockService).session()).toBeNull();
        });
    });

    it('lets the stream stop when the page closes its own player', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });

        page.release(SNAPSHOT);

        expect(TestBed.inject(NowPlayingDockService).session()).toBeNull();
    });

    it('ends the bar when a page starts playing, unless it is the bar', () => {
        const dock = TestBed.inject(NowPlayingDockService);
        handOver();

        createBarView().pageStarted();
        expect(dock.session()).not.toBeNull();

        create().pageStarted();
        expect(dock.session()).toBeNull();
    });

    it('ends the bar for a page player that does not dock (Embedded MPV)', () => {
        // An Embedded MPV movie or channel never goes to the bar, but its
        // stream is the account's one connection all the same.
        const dock = TestBed.inject(NowPlayingDockService);
        handOver();
        const releaseBarPlayer = dock.registerPlayer();

        const mpvPage = create(false);
        mpvPage.pageStarted();

        expect(dock.session()).toBeNull();
        expect(mpvPage.waits()).toBe(true);
        releaseBarPlayer();
        expect(mpvPage.waits()).toBe(false);
    });

    it('stops a page player when another one claims the stream', () => {
        const first = create();
        const second = create(false);
        first.pageStarted();
        expect(first.stopped()).toBe(false);

        second.pageStarted();

        expect(first.stopped()).toBe(true);
        expect(second.stopped()).toBe(false);
        // The second waits until the first one's engine is gone.
        expect(second.waits()).toBe(true);
        first.release(SNAPSHOT);
        expect(second.waits()).toBe(false);
    });

    it('claims the stream back once its page asks for a new stream', () => {
        const request = signal('channel-1');
        const page = TestBed.runInInjectionContext(
            () =>
                new NowPlayingPageHandoff(
                    () => true,
                    () => false,
                    () => request()
                )
        );
        page.pageStarted();
        TestBed.tick();
        const other = create();
        other.pageStarted();
        expect(page.stopped()).toBe(true);

        // Its own reloads keep the request: it stays stopped.
        TestBed.tick();
        expect(page.stopped()).toBe(true);

        request.set('channel-2');
        TestBed.tick();
        expect(page.stopped()).toBe(false);
        expect(other.stopped()).toBe(true);
    });

    it('is not stopped by a bar that mounts for the session it just ended', () => {
        // Back to a page that plays at once: the hand-over and the page's
        // start land in one render, so the shell still mounts the bar for
        // the session the page already ended. That bar must not take the
        // stream (the page would stay blank); the page waits for it.
        const dock = TestBed.inject(NowPlayingDockService);
        handOver();
        const page = create();
        page.pageStarted();
        expect(dock.session()).toBeNull();

        const releaseLateBar = dock.registerPlayer();

        expect(page.stopped()).toBe(false);
        expect(page.waits()).toBe(true);
        releaseLateBar();
        expect(page.waits()).toBe(false);
    });

    it('stops the bar when a page player claims the stream before it unmounts', () => {
        const dock = TestBed.inject(NowPlayingDockService);
        handOver();
        const stopBar = jest.fn();
        dock.registerPlayer(stopBar);

        create().pageStarted();

        expect(stopBar).toHaveBeenCalledTimes(1);
    });

    it("holds a page's stream until the bar's player has let go of its own", () => {
        const dock = TestBed.inject(NowPlayingDockService);
        const page = create();
        const releaseBarPlayer = dock.registerPlayer();

        // The session ends at once, but the bar unmounts a render later:
        // until its player closed the connection, the page must not open one.
        page.pageStarted();
        expect(dock.session()).toBeNull();
        expect(page.waits()).toBe(true);
        expect(createBarView().waits()).toBe(false);

        releaseBarPlayer();
        releaseBarPlayer();
        expect(page.waits()).toBe(false);
        expect(dock.playerMounted()).toBe(false);
    });
});
