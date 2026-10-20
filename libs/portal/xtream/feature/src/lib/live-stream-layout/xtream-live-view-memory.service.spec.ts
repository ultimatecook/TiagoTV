import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createPlaybackSessionKey } from '@iptvnator/playback/util';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import { NowPlayingDockService } from '@iptvnator/ui/playback';
import type { XtreamLiveChannelItem } from './xtream-live-channel-navigation.service';
import {
    recallXtreamLiveView,
    XTREAM_LIVE_VIEW_STATE_KEY,
    XtreamLiveViewMemoryService,
} from './xtream-live-view-memory.service';

describe('XtreamLiveViewMemoryService', () => {
    const channels: XtreamLiveChannelItem[] = [
        { xtream_id: 6, title: 'Six', category_id: '3' },
        { xtream_id: 7, title: 'Seven', category_id: '3' },
    ];
    const session = signal<{ sessionKey: string } | null>(null);
    const pendingItemId = signal<number | null>(null);
    const open = jest.fn();

    function setUp(): XtreamLiveViewMemoryService {
        TestBed.configureTestingModule({
            providers: [
                XtreamLiveViewMemoryService,
                {
                    provide: XtreamStore,
                    useValue: {
                        currentPlaylist: signal({ id: 'p1' }),
                        selectedContentType: signal('live'),
                        isContentInitialized: signal(true),
                    },
                },
                { provide: NowPlayingDockService, useValue: { session } },
            ],
        });
        const memory = TestBed.inject(XtreamLiveViewMemoryService);
        TestBed.runInInjectionContext(() =>
            memory.connect({
                pendingItemId,
                channels: () => channels,
                open,
                listViewport: signal(undefined),
            })
        );
        TestBed.tick();
        return memory;
    }

    function enterWith(memory: unknown): void {
        window.history.replaceState(
            { keep: 1, [XTREAM_LIVE_VIEW_STATE_KEY]: memory },
            document.title
        );
    }

    beforeEach(() => {
        session.set(null);
        pendingItemId.set(null);
        open.mockReset();
    });
    afterEach(() => window.history.replaceState({}, document.title));

    it('keeps the played channel on the history entry, adding none', () => {
        window.history.replaceState({ keep: 1 }, document.title);
        const memory = setUp();

        memory.rememberChannel(7);

        expect(window.history.state.keep).toBe(1);
        expect(recallXtreamLiveView(window.history.state)).toEqual({
            playlistId: 'p1',
            channelId: 7,
        });
    });

    it('plays the remembered channel again when nothing else plays', () => {
        enterWith({ playlistId: 'p1', channelId: 7, listOffset: 1200 });
        setUp();

        expect(open).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith(channels[1], true);
    });

    it('takes it over from the mini-player that plays it', () => {
        enterWith({ playlistId: 'p1', channelId: 7 });
        session.set({
            sessionKey: createPlaybackSessionKey({
                kind: 'live',
                sourceId: 'p1',
                contentId: 7,
            }),
        });
        setUp();

        expect(open).toHaveBeenCalledWith(channels[1], true);
    });

    it("only selects it while the mini-player plays another page's stream", () => {
        enterWith({ playlistId: 'p1', channelId: 7 });
        session.set({ sessionKey: 'vod:p1:50041' });
        setUp();

        expect(open).toHaveBeenCalledWith(channels[1], false);
    });

    it('leaves the channel a way in asked for alone', () => {
        enterWith({ playlistId: 'p1', channelId: 7 });
        pendingItemId.set(6);
        setUp();

        expect(open).not.toHaveBeenCalled();
    });

    it('reads nothing from another playlist or a malformed entry', () => {
        expect(recallXtreamLiveView({})).toBeNull();
        expect(
            recallXtreamLiveView({
                [XTREAM_LIVE_VIEW_STATE_KEY]: { playlistId: 'p1', channelId: 0 },
            })
        ).toBeNull();
        enterWith({ playlistId: 'p2', channelId: 7 });
        setUp();
        expect(open).not.toHaveBeenCalled();
    });
});
