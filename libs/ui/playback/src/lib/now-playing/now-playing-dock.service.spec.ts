import { TestBed } from '@angular/core/testing';
import {
    NowPlayingDockService,
    type NowPlayingHandoff,
} from './now-playing-dock.service';

const HANDOFF: NowPlayingHandoff = {
    sessionKey: 'session-1',
    streamUrl: 'http://portal.test/movie/u/p/1.mp4',
    playback: null,
    title: 'Black Harbor',
    subtitle: null,
    artworkUrl: null,
    startTime: 30,
    duration: 3600,
    isLive: false,
    paused: false,
    volume: 1,
    muted: false,
    returnUrl: '/workspace/xtreams/p1/vod/10/1',
    returnState: null,
};

describe('NowPlayingDockService', () => {
    let dock: NowPlayingDockService;

    beforeEach(() => {
        dock = TestBed.inject(NowPlayingDockService);
    });

    it('holds one session, a new id per handoff', () => {
        dock.handOff(HANDOFF);
        const first = dock.session();
        dock.handOff({ ...HANDOFF, title: 'Copper Rain' });

        expect(first?.title).toBe('Black Harbor');
        expect(dock.session()?.title).toBe('Copper Rain');
        expect(dock.session()?.id).not.toBe(first?.id);
    });

    it('ends when a page starts its own playback, or on close', () => {
        dock.handOff(HANDOFF);
        dock.pagePlaybackStarted();
        expect(dock.session()).toBeNull();

        dock.handOff(HANDOFF);
        dock.close();
        expect(dock.session()).toBeNull();
    });
});
