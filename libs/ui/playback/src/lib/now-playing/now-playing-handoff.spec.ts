import {
    navigationReturnState,
    resolveNowPlayingHandoff,
    type NowPlayingTeardown,
} from './now-playing-handoff';

function teardown(
    overrides: Partial<NowPlayingTeardown> = {}
): NowPlayingTeardown {
    return {
        dockable: true,
        navigatingAway: true,
        streamUrl: 'http://portal.test/movie/u/p/1.mp4',
        sessionKey: 'session-1',
        playback: {
            streamUrl: 'http://portal.test/movie/u/p/1.mp4',
            title: 'Black Harbor',
            thumbnail: 'poster.jpg',
        },
        title: 'Black Harbor',
        subtitle: null,
        isLive: false,
        progress: { currentTime: 125.4, duration: 3600, playing: true },
        video: null,
        fallbackVolume: 0.8,
        returnUrl: '/workspace/xtreams/p1/vod/10/1',
        returnState: null,
        ...overrides,
    };
}

describe('resolveNowPlayingHandoff', () => {
    it('continues a film the user navigated away from mid-playback', () => {
        expect(resolveNowPlayingHandoff(teardown())).toEqual({
            sessionKey: 'session-1',
            streamUrl: 'http://portal.test/movie/u/p/1.mp4',
            playback: expect.objectContaining({ title: 'Black Harbor' }),
            title: 'Black Harbor',
            subtitle: null,
            artworkUrl: 'poster.jpg',
            startTime: 125.4,
            duration: 3600,
            isLive: false,
            paused: false,
            volume: 0.8,
            muted: false,
            returnUrl: '/workspace/xtreams/p1/vod/10/1',
            returnState: null,
        });
    });

    it('tells the mini-player the picture was in picture-in-picture', () => {
        expect(
            resolveNowPlayingHandoff(teardown({ pictureInPicture: true }))
                ?.pictureInPicture
        ).toBe(true);
        expect(resolveNowPlayingHandoff(teardown())).not.toHaveProperty(
            'pictureInPicture'
        );
    });

    it('stays out when the page closed its player, or never played', () => {
        expect(
            resolveNowPlayingHandoff(teardown({ navigatingAway: false }))
        ).toBeNull();
        expect(resolveNowPlayingHandoff(teardown({ progress: null }))).toBe(
            null
        );
        expect(
            resolveNowPlayingHandoff(teardown({ dockable: false }))
        ).toBeNull();
    });

    it('lets a film that is all but over end with its page', () => {
        expect(
            resolveNowPlayingHandoff(
                teardown({
                    progress: {
                        currentTime: 3595,
                        duration: 3600,
                        playing: true,
                    },
                })
            )
        ).toBeNull();
    });

    it('keeps a paused stream paused, at its position', () => {
        const handoff = resolveNowPlayingHandoff(
            teardown({
                progress: { currentTime: 40, duration: 3600, playing: false },
            })
        );

        expect(handoff?.paused).toBe(true);
        expect(handoff?.startTime).toBe(40);
    });

    it('rejoins live channels at the live edge', () => {
        const handoff = resolveNowPlayingHandoff(
            teardown({
                isLive: true,
                progress: { currentTime: 900, duration: 0, playing: true },
            })
        );

        expect(handoff).toMatchObject({ startTime: 0, duration: 0 });
    });

    it('reads the volume from a media element that still holds its source', () => {
        const withSource = resolveNowPlayingHandoff(
            teardown({
                video: { volume: 0.3, muted: true, currentSrc: 'blob:x' },
            })
        );
        const reset = resolveNowPlayingHandoff(
            teardown({ video: { volume: 1, muted: false, currentSrc: '' } })
        );

        expect(withSource).toMatchObject({ volume: 0.3, muted: true });
        expect(reset).toMatchObject({ volume: 0.8, muted: false });
    });
});

describe('navigationReturnState', () => {
    it('drops the router bookkeeping and keeps the page state', () => {
        expect(
            navigationReturnState({
                navigationId: 4,
                ɵrouterPageId: 3,
                openXtreamLiveItemId: 101,
            })
        ).toEqual({ openXtreamLiveItemId: 101 });
    });

    it('gives null when nothing is left', () => {
        expect(navigationReturnState({ navigationId: 1 })).toBeNull();
        expect(navigationReturnState(null)).toBeNull();
    });
});
