import type { TitlePlatformRef } from '@iptvnator/services';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';
import { playbackContentKey, subtitleLookupFor } from './subtitle-lookup';

const movie: ResolvedPortalPlayback = {
    streamUrl: 'http://provider.invalid/movie/1.mkv',
    title: 'EN - Death Inc. (2024)',
    contentInfo: { playlistId: 'p1', contentXtreamId: 13, contentType: 'vod' },
};
const episode: ResolvedPortalPlayback = {
    streamUrl: 'http://provider.invalid/series/9.mkv',
    title: 'Episode 3',
    contentInfo: {
        playlistId: 'p1',
        contentXtreamId: 903,
        contentType: 'episode',
        seriesXtreamId: 77,
        seasonNumber: 2,
        episodeNumber: 3,
    },
};
const lookup = { name: 'Death Inc.', year: 2024, tmdbId: 1001, imdbId: null };

describe('subtitle lookup of a playback', () => {
    it('keys a movie or episode, never live TV', () => {
        expect(playbackContentKey(movie)).toBe('p1:vod:13');
        expect(playbackContentKey({ ...movie, isLive: true })).toBeNull();
        expect(playbackContentKey(null)).toBeNull();
    });

    it("takes the title page's ids when it shows this very movie", () => {
        const page: TitlePlatformRef = {
            playlistId: 'p1',
            kind: 'movie',
            itemId: '13',
            lookup,
        };

        expect(subtitleLookupFor(movie, page)).toEqual({
            kind: 'movie',
            title: 'Death Inc.',
            year: 2024,
            tmdbId: 1001,
            imdbId: null,
        });
        // Another source's copy: the playback's own name only.
        expect(
            subtitleLookupFor(
                {
                    ...movie,
                    contentInfo: { ...movie.contentInfo!, playlistId: 'p2' },
                },
                page
            )
        ).toEqual(
            expect.objectContaining({
                title: 'EN - Death Inc. (2024)',
                tmdbId: null,
            })
        );
    });

    it('needs the series page for an episode', () => {
        const page: TitlePlatformRef = {
            playlistId: 'p1',
            kind: 'series',
            itemId: 77,
            lookup: { name: 'Muertos S.L.', tmdbId: 55 },
        };

        expect(subtitleLookupFor(episode, page)).toEqual({
            kind: 'episode',
            title: 'Muertos S.L.',
            year: null,
            tmdbId: 55,
            imdbId: null,
            season: 2,
            episode: 3,
        });
        expect(subtitleLookupFor(episode, null)).toBeNull();
        expect(subtitleLookupFor({ ...movie, isLive: true }, null)).toBeNull();
    });
});
