import {
    ResolvedPortalPlayback,
    VideoPlayer,
} from '@iptvnator/shared/interfaces';
import { preferEmbeddedMpvForVod } from './vod-embedded-mpv';

const MOVIE = {
    streamUrl: 'http://portal.test/movie/u/p/1.mkv',
    contentInfo: { playlistId: 'p1', contentXtreamId: 1, contentType: 'vod' },
} as unknown as ResolvedPortalPlayback;
const CHANNEL = {
    streamUrl: 'http://portal.test/live/u/p/2.ts',
    isLive: true,
} as unknown as ResolvedPortalPlayback;

describe('preferEmbeddedMpvForVod', () => {
    it('plays movies and episodes on Embedded MPV where it is available', () => {
        expect(preferEmbeddedMpvForVod(VideoPlayer.VideoJs, MOVIE, true)).toBe(
            VideoPlayer.EmbeddedMpv
        );
        expect(
            preferEmbeddedMpvForVod(VideoPlayer.Html5Player, MOVIE, true)
        ).toBe(VideoPlayer.EmbeddedMpv);
    });

    it('keeps the configured player for live channels and without MPV', () => {
        expect(
            preferEmbeddedMpvForVod(VideoPlayer.VideoJs, CHANNEL, true)
        ).toBe(VideoPlayer.VideoJs);
        expect(preferEmbeddedMpvForVod(VideoPlayer.VideoJs, MOVIE, false)).toBe(
            VideoPlayer.VideoJs
        );
        expect(preferEmbeddedMpvForVod(VideoPlayer.VideoJs, null, true)).toBe(
            VideoPlayer.VideoJs
        );
    });

    it('leaves an external player choice alone', () => {
        expect(preferEmbeddedMpvForVod(VideoPlayer.VLC, MOVIE, true)).toBe(
            VideoPlayer.VLC
        );
    });
});
