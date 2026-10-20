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
import { SportsCatalogService } from '../sports/sports-catalog.service';
import { buildCountriesTv } from './countries-catalog';
import { CountryTvPlayback } from './country-tv-playback';
import {
    findSelection,
    LAST_CHANNEL_STORAGE_KEY,
    type TvSelection,
} from './country-tv-start';

const SOURCE = {
    _id: 'source-1',
    title: 'Panel',
    serverUrl: 'http://panel.test',
    username: 'user',
    password: 'secret',
    userAgent: 'TiagoTV',
} as PlaylistMeta;

const COUNTRIES = buildCountriesTv(
    [{ category_id: 7, category_name: '|LAT|  ✪ ARGENTINA' }],
    [
        { stream_id: 21, category_id: 7, name: '|ARG| TELEFE ᴴᴰ' },
        { stream_id: 22, category_id: 7, name: '|ARG| TELEFE' },
        {
            stream_id: 30,
            category_id: 7,
            name: '|ARG| C5N',
            stream_icon: 'c5n.png',
        },
    ],
    new Date('2026-10-18T18:00:00Z')
);
const telefe = findSelection(COUNTRIES, 21) as TvSelection;
const c5n = findSelection(COUNTRIES, 30) as TvSelection;

describe('CountryTvPlayback', () => {
    let tv: CountryTvPlayback;
    const embedded = signal(true);
    const session = signal<{ returnUrl: string; sessionKey?: string } | null>(
        null
    );
    const closeDock = jest.fn(() => session.set(null));
    const lockVersion = signal(0);
    const locked = jest.fn(() => false);
    const player = {
        isEmbeddedPlayer: () => embedded(),
        openResolvedPlayback: jest.fn(async () => undefined),
        openExternalPlayback: jest.fn(async () => undefined),
    };
    const gate = { defer: jest.fn() };
    const recent = {
        recordLivePlayback: jest.fn(async (item: unknown) => item),
    };
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
        localStorage.clear();
        jest.clearAllMocks();
        embedded.set(true);
        session.set(null);
        locked.mockReturnValue(false);
        currentPlaylist.set(null);
        TestBed.configureTestingModule({
            providers: [
                CountryTvPlayback,
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
        tv = TestBed.inject(CountryTvPlayback);
    });

    it('plays a picked channel the way the live view does', () => {
        tv.play(c5n);

        expect(urls.constructLiveUrl).toHaveBeenCalledWith(
            {
                serverUrl: 'http://panel.test',
                username: 'user',
                password: 'secret',
                allowedOutputFormats: undefined,
            },
            30
        );
        expect(tv.playback()).toEqual({
            streamUrl: 'http://panel.test/live/user/secret/30.ts',
            liveAutoTsUrl: undefined,
            userAgent: 'TiagoTV',
            referer: undefined,
            origin: undefined,
            title: 'C5N',
            thumbnail: 'c5n.png',
            isLive: true,
        });
        expect(tv.sessionKey()).toBe(
            createPlaybackSessionKey({
                kind: 'live',
                sourceId: 'source-1',
                contentId: 30,
            })
        );
        expect(localStorage.getItem(LAST_CHANNEL_STORAGE_KEY)).toBe('30');
    });

    it('files the channel in Recently viewed once it has played', async () => {
        tv.play(c5n);

        expect(gate.defer).toHaveBeenCalledWith(
            {
                sessionKey: tv.sessionKey(),
                streamUrls: ['http://panel.test/live/user/secret/30.ts'],
            },
            expect.any(Function)
        );
        expect(recent.recordLivePlayback).not.toHaveBeenCalled();
        gate.defer.mock.calls[0][1]();
        expect(recent.recordLivePlayback).toHaveBeenCalledWith(
            expect.objectContaining({
                uid: 'xtream::source-1::live:30',
                sourceType: 'xtream',
                contentType: 'live',
                xtreamId: 30,
                categoryId: '7',
                logo: 'c5n.png',
            })
        );
    });

    it('switches to another channel or copy, and ignores the playing one', () => {
        tv.play(telefe);
        expect(tv.playback()?.streamUrl).toMatch(/\/21\.ts$/);

        tv.play(c5n);
        expect(tv.playback()?.streamUrl).toMatch(/\/30\.ts$/);
        expect(tv.selection()?.channel.title).toBe('C5N');

        urls.constructLiveUrl.mockClear();
        tv.play(c5n);
        expect(urls.constructLiveUrl).not.toHaveBeenCalled();

        tv.play(telefe);
        tv.playCopy(telefe.channel.copies[1]);
        expect(tv.selection()?.copy.streamId).toBe(22);
        expect(tv.playback()?.streamUrl).toMatch(/\/22\.ts$/);
    });

    it('takes the account’s formats when the live view learned them', () => {
        currentPlaylist.set({ id: 'source-1', allowedOutputFormats: ['ts'] });
        tv.play(c5n);
        expect(urls.constructAutoLiveTsUrl).toHaveBeenCalledWith(
            expect.objectContaining({ allowedOutputFormats: ['ts'] }),
            30
        );
    });

    it('opens on its channel unless the mini-player plays another page’s', () => {
        tv.open(telefe);
        expect(tv.playback()?.streamUrl).toMatch(/\/21\.ts$/);

        tv.stop();
        session.set({ returnUrl: '/workspace/movies/1' });
        tv.open(c5n);
        expect(tv.selection()?.channel.title).toBe('C5N');
        expect(tv.playback()).toBeNull();

        session.set({ returnUrl: '/workspace/countries' });
        tv.open(c5n);
        expect(tv.playback()?.streamUrl).toMatch(/\/30\.ts$/);
    });

    it('takes over the channel the mini-player is playing', () => {
        // Back from the live view: the mini-player continues its channel;
        // the page plays it again instead of sitting idle beside it.
        const key = createPlaybackSessionKey({
            kind: 'live',
            sourceId: SOURCE._id,
            contentId: 30,
        });
        session.set({
            returnUrl: '/workspace/xtreams/x/live',
            sessionKey: key,
        });

        tv.open(telefe);
        expect(tv.playback()).toBeNull();
        tv.open(c5n);
        expect(tv.playback()?.streamUrl).toMatch(/\/30\.ts$/);
    });

    it('ends the mini-player before MPV or VLC opens its own stream', () => {
        embedded.set(false);
        session.set({ returnUrl: '/workspace/countries' });

        tv.play(c5n);

        expect(closeDock).toHaveBeenCalled();
        expect(closeDock.mock.invocationCallOrder[0]).toBeLessThan(
            player.openResolvedPlayback.mock.invocationCallOrder[0]
        );
    });

    it('launches MPV or VLC instead of playing inline, never on opening', () => {
        embedded.set(false);
        tv.open(telefe);
        expect(player.openResolvedPlayback).not.toHaveBeenCalled();

        tv.play(c5n);
        expect(tv.playback()).toBeNull();
        expect(player.openResolvedPlayback).toHaveBeenCalledWith(
            expect.objectContaining({
                streamUrl: expect.stringMatching(/30\.ts$/),
            })
        );
        expect(gate.defer.mock.calls[0][0].sessionKey).toBeNull();
    });

    it('stops a channel whose category a relock withholds', () => {
        tv.play(c5n);
        TestBed.tick();
        expect(tv.playback()).not.toBeNull();

        locked.mockReturnValue(true);
        lockVersion.update((version) => version + 1);
        TestBed.tick();
        expect(locked).toHaveBeenCalledWith('source-1', 'live', 7);
        expect(tv.playback()).toBeNull();
    });
});
