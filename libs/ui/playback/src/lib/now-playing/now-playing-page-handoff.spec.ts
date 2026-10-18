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

    it('also hands over once the URL already moved on', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });

        router.url = '/workspace/dashboard';
        page.release(SNAPSHOT);

        expect(TestBed.inject(NowPlayingDockService).session()).not.toBeNull();
    });

    it('lets the stream stop when the page closes its own player', () => {
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });

        page.release(SNAPSHOT);

        expect(TestBed.inject(NowPlayingDockService).session()).toBeNull();
    });

    it('ends the bar when a page starts playing, unless it is the bar', () => {
        const dock = TestBed.inject(NowPlayingDockService);
        const page = create();
        page.record({ currentTime: 42, duration: 3600, playing: true });
        router.currentNavigation.set({ id: 2 });
        page.release(SNAPSHOT);

        create(false).pageStarted();
        expect(dock.session()).not.toBeNull();

        create().pageStarted();
        expect(dock.session()).toBeNull();
    });
});
