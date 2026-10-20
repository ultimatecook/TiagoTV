import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UnifiedRecentDataService } from '@iptvnator/portal/shared/data-access';
import { PORTAL_PLAYER } from '@iptvnator/portal/shared/util';
import {
    XtreamStore,
    XtreamUrlService,
} from '@iptvnator/portal/xtream/data-access';
import { PlaybackHistoryGate } from '@iptvnator/playback/data-access';
import { createPlaybackSessionKey } from '@iptvnator/playback/util';
import { ParentalLockService } from '@iptvnator/services';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { NowPlayingDockService } from '@iptvnator/ui/playback';
import type { SportChannel } from './sports-catalog';
import { SportsCatalogService } from './sports-catalog.service';
import { SportTvPlayback } from './sport-tv-playback';

const SOURCE = {
    _id: 'source-1',
    title: 'Panel',
    serverUrl: 'http://panel.test',
    username: 'user',
    password: 'secret',
    userAgent: 'TiagoTV',
} as PlaylistMeta;

const DAZN_1: SportChannel = {
    streamId: 11,
    categoryId: '5',
    title: 'DAZN LaLiga 1',
    icon: 'dazn.png',
};
const DAZN_2: SportChannel = {
    ...DAZN_1,
    streamId: 12,
    title: 'DAZN LaLiga 2',
};

describe('SportTvPlayback', () => {
    let tv: SportTvPlayback;
    const embedded = signal(true);
    const session = signal<{ returnUrl: string; sessionKey?: string } | null>(
        null
    );
    const closeDock = jest.fn(() => session.set(null));
    const locked = jest.fn(() => false);
    const lockVersion = signal(0);
    const player = {
        isEmbeddedPlayer: () => embedded(),
        openResolvedPlayback: jest.fn(async () => undefined),
        openExternalPlayback: jest.fn(async () => undefined),
    };
    const gate = { defer: jest.fn() };
    const recent = { recordLivePlayback: jest.fn(async () => undefined) };
    const urls = {
        constructLiveUrl: jest.fn(
            (_: unknown, id: number) =>
                `http://panel.test/live/user/secret/${id}.ts`
        ),
        constructAutoLiveTsUrl: jest.fn(() => undefined),
    };
    const currentPlaylist = signal<{
        id: string;
        allowedOutputFormats?: string[];
    } | null>(null);

    beforeEach(() => {
        jest.clearAllMocks();
        embedded.set(true);
        session.set(null);
        locked.mockReturnValue(false);
        currentPlaylist.set(null);
        TestBed.configureTestingModule({
            providers: [
                SportTvPlayback,
                {
                    provide: SportsCatalogService,
                    useValue: { source: signal(SOURCE) },
                },
                { provide: XtreamUrlService, useValue: urls },
                { provide: XtreamStore, useValue: { currentPlaylist } },
                { provide: PORTAL_PLAYER, useValue: player },
                { provide: PlaybackHistoryGate, useValue: gate },
                { provide: UnifiedRecentDataService, useValue: recent },
                {
                    provide: ParentalLockService,
                    useValue: {
                        version: lockVersion,
                        isXtreamCategoryLocked: locked,
                    },
                },
                {
                    provide: NowPlayingDockService,
                    useValue: { session, close: closeDock },
                },
            ],
        });
        tv = TestBed.inject(SportTvPlayback);
    });

    it('plays a channel the way the live view does', () => {
        tv.play(DAZN_1);

        expect(urls.constructLiveUrl).toHaveBeenCalledWith(
            {
                serverUrl: 'http://panel.test',
                username: 'user',
                password: 'secret',
                allowedOutputFormats: undefined,
            },
            11
        );
        expect(tv.playback()).toEqual({
            streamUrl: 'http://panel.test/live/user/secret/11.ts',
            liveAutoTsUrl: undefined,
            userAgent: 'TiagoTV',
            referer: undefined,
            origin: undefined,
            title: 'DAZN LaLiga 1',
            thumbnail: 'dazn.png',
            isLive: true,
        });
        expect(tv.sessionKey()).toBe(
            createPlaybackSessionKey({
                kind: 'live',
                sourceId: 'source-1',
                contentId: 11,
            })
        );
    });

    it('files the channel in Recently viewed once it has played', () => {
        tv.play(DAZN_1);
        expect(recent.recordLivePlayback).not.toHaveBeenCalled();
        gate.defer.mock.calls[0][1]();
        expect(recent.recordLivePlayback).toHaveBeenCalledWith(
            expect.objectContaining({
                uid: 'xtream::source-1::live:11',
                contentType: 'live',
                xtreamId: 11,
                categoryId: '5',
                logo: 'dazn.png',
            })
        );
    });

    it('switches signals and keeps the playing one', () => {
        tv.play(DAZN_1);
        tv.play(DAZN_2);
        expect(tv.playback()?.streamUrl).toMatch(/\/12\.ts$/);

        urls.constructLiveUrl.mockClear();
        tv.play(DAZN_2);
        expect(urls.constructLiveUrl).not.toHaveBeenCalled();
    });

    it('takes the account’s formats when the live view learned them', () => {
        currentPlaylist.set({ id: 'source-1', allowedOutputFormats: ['ts'] });
        tv.play(DAZN_1);
        expect(urls.constructAutoLiveTsUrl).toHaveBeenCalledWith(
            expect.objectContaining({ allowedOutputFormats: ['ts'] }),
            11
        );
    });

    it('opens on its channel unless the mini-player plays another page’s', () => {
        session.set({ returnUrl: '/workspace/movies/1' });
        tv.open(DAZN_1);
        expect(tv.selection()).toEqual(DAZN_1);
        expect(tv.playback()).toBeNull();

        session.set({ returnUrl: '/workspace/sports/laliga' });
        tv.open(DAZN_2);
        expect(tv.playback()?.streamUrl).toMatch(/\/12\.ts$/);
    });

    it('plays a channel the way in asked for, over another page’s mini-player', () => {
        // "Ver en …" on the hub or Home: the match starts; the page's player
        // ends the mini-player's stream before it opens its own.
        session.set({ returnUrl: '/workspace/movies/1' });
        tv.open(DAZN_1, true);
        expect(tv.playback()?.streamUrl).toMatch(/\/11\.ts$/);
    });

    it('takes over the channel the mini-player is playing', () => {
        session.set({
            returnUrl: '/workspace/xtreams/source-1/live',
            sessionKey: liveKey(12),
        });
        tv.open(DAZN_1);
        expect(tv.playback()).toBeNull();

        tv.open(DAZN_2);
        expect(tv.playback()?.streamUrl).toMatch(/\/12\.ts$/);
        expect(tv.dockedChannel([DAZN_1, DAZN_2])).toBe(DAZN_2);
    });

    it('launches MPV or VLC instead, never on opening', () => {
        embedded.set(false);
        tv.open(DAZN_1);
        expect(player.openResolvedPlayback).not.toHaveBeenCalled();

        tv.play(DAZN_2);
        expect(tv.playback()).toBeNull();
        expect(player.openResolvedPlayback).toHaveBeenCalledWith(
            expect.objectContaining({
                streamUrl: expect.stringMatching(/12\.ts$/),
            })
        );
    });

    it('ends the mini-player before MPV or VLC opens its own stream', () => {
        embedded.set(false);
        session.set({ returnUrl: '/workspace/sports/laliga' });

        tv.play(DAZN_1);

        expect(closeDock).toHaveBeenCalled();
        expect(closeDock.mock.invocationCallOrder[0]).toBeLessThan(
            player.openResolvedPlayback.mock.invocationCallOrder[0]
        );
    });

    it('clears the stage: no channel, no stream', () => {
        tv.play(DAZN_1);
        tv.clear();
        expect(tv.playback()).toBeNull();
        expect(tv.selection()).toBeNull();
    });

    it('stops a channel its category’s lock withholds', () => {
        tv.play(DAZN_1);
        TestBed.tick();
        locked.mockReturnValue(true);
        lockVersion.set(1);
        TestBed.tick();
        expect(tv.playback()).toBeNull();
    });
});

function liveKey(streamId: number): string {
    return createPlaybackSessionKey({
        kind: 'live',
        sourceId: 'source-1',
        contentId: streamId,
    });
}
