import {
    platformDesign,
    RANKED_DRESS,
    rowTile,
    tileDress,
} from './platform-design';
import { platformOfRoute, readPlatformRoute } from './platform-theme';
import { cssString } from './platform-theme.service';
import { buildPlatformShelves } from './streaming-platforms';

describe('platform theme', () => {
    const shelves = buildPlatformShelves(
        [
            { category_id: 1610, category_name: '|ES| ✪ ORIGINAL NETFLIX' },
            { category_id: 1700, category_name: '|EN| ✪ AMAZON-PRIME' },
            { category_id: 1800, category_name: '|ES| ✪ ACCIÓN' },
        ],
        [{ category_id: 482, category_name: '|EN| ✪ NETFLIX' }]
    );

    it('reads a platform page and a title page from the URL', () => {
        expect(readPlatformRoute('/workspace/platforms/hbo-max')).toEqual({
            page: 'platform',
            platformId: 'hbo-max',
        });
        expect(
            readPlatformRoute('/workspace/xtreams/p1/vod/1610/161002?x=1')
        ).toEqual({
            page: 'detail',
            playlistId: 'p1',
            kind: 'movie',
            categoryId: '1610',
        });
        expect(
            readPlatformRoute('/workspace/xtreams/p1/series/482/48200')
        ).toMatchObject({ kind: 'series', categoryId: '482' });
    });

    it('leaves the other pages alone, a category grid among them', () => {
        expect(readPlatformRoute('/workspace/dashboard')).toBeNull();
        expect(readPlatformRoute('/workspace/xtreams/p1/vod/1610')).toBeNull();
        expect(readPlatformRoute('/workspace/xtreams/p1/live/3/4')).toBeNull();
    });

    it('finds the platform whose catalog files the title', () => {
        const movie = readPlatformRoute('/workspace/xtreams/p1/vod/1700/9');
        const series = readPlatformRoute('/workspace/xtreams/p1/series/482/9');

        expect(platformOfRoute(movie, 'p1', shelves)?.id).toBe('prime-video');
        expect(platformOfRoute(series, 'p1', shelves)?.id).toBe('netflix');
    });

    it('needs the same source, the same kind and a platform category', () => {
        const route = (url: string) => readPlatformRoute(url);

        expect(
            platformOfRoute(
                route('/workspace/xtreams/p2/vod/1610/9'),
                'p1',
                shelves
            )
        ).toBeNull();
        expect(
            platformOfRoute(
                route('/workspace/xtreams/p1/series/1610/9'),
                'p1',
                shelves
            )
        ).toBeNull();
        expect(
            platformOfRoute(
                route('/workspace/xtreams/p1/vod/1800/9'),
                'p1',
                shelves
            )
        ).toBeNull();
        expect(
            platformOfRoute(
                route('/workspace/xtreams/p1/vod/1610/9'),
                'p1',
                null
            )
        ).toBeNull();
    });

    it('takes the platform page id without the catalog', () => {
        expect(
            platformOfRoute(
                readPlatformRoute('/workspace/platforms/apple-tv'),
                null,
                null
            )?.id
        ).toBe('apple-tv');
        expect(
            platformOfRoute(
                readPlatformRoute('/workspace/platforms/nope'),
                null,
                null
            )
        ).toBeNull();
    });

    it('draws Netflix, Prime Video, HBO Max and Apple TV their own way', () => {
        expect(platformDesign('netflix')).toMatchObject({
            look: 'netflix',
            hero: 'billboard',
            tiles: 'landscape',
            top10: true,
        });
        expect(platformDesign('prime-video').hero).toBe('carousel');
        // HBO Max's 16:9 tiles since June 2025, Apple TV's posters since
        // tvOS 26.
        expect(platformDesign('hbo-max').tiles).toBe('landscape');
        expect(platformDesign('apple-tv')).toMatchObject({
            look: 'apple',
            tiles: 'poster',
        });
    });

    it('draws the other seven platforms their own way too', () => {
        expect(platformDesign('disney-plus')).toMatchObject({
            look: 'disney',
            hero: 'carousel',
            tiles: 'poster',
            brands: true,
            playKey: 'WORKSPACE.PLATFORMS.PLAY',
        });
        expect(platformDesign('paramount-plus')).toMatchObject({
            look: 'paramount',
            hero: 'billboard',
        });
        expect(platformDesign('hulu')).toMatchObject({
            look: 'hulu',
            hero: 'billboard',
            top10: false,
            playKey: 'WORKSPACE.PLATFORMS.PLAY',
        });
        expect(platformDesign('movistar-plus').look).toBe('movistar');
        expect(platformDesign('atresplayer').look).toBe('atres');
        expect(platformDesign('mitele')).toMatchObject({
            look: 'mitele',
            hero: 'carousel',
        });
        expect(platformDesign('crave')).toMatchObject({
            look: 'crave',
            playKey: 'WORKSPACE.PLATFORMS.WATCH',
        });
    });

    it("mixes Paramount+'s poster rows into its 16:9 ones", () => {
        const paramount = platformDesign('paramount-plus');

        expect(rowTile(paramount, 'newest')).toBe('landscape');
        expect(rowTile(paramount, 'series')).toBe('poster');
        expect(rowTile(paramount, 'genre-drama')).toBe('landscape');
        expect(rowTile(platformDesign('hbo-max'), 'series')).toBe('poster');
        expect(rowTile(platformDesign('netflix'), 'series')).toBe('landscape');
    });

    it('dresses each row as the platform does', () => {
        const netflix = platformDesign('netflix');
        expect(tileDress(netflix, 'movies')).toEqual({
            tile: 'landscape',
            large: false,
            caption: true,
            sub: false,
            info: true,
        });
        // Prime Video's "super carousel": its series in large posters.
        expect(tileDress(platformDesign('prime-video'), 'series')).toEqual({
            tile: 'poster',
            large: true,
            caption: false,
            sub: false,
            info: true,
        });
        // Apple TV's large 16:9 cards first, then its posters.
        const apple = platformDesign('apple-tv');
        expect(tileDress(apple, 'newest')).toMatchObject({
            tile: 'landscape',
            large: true,
            caption: false,
            sub: true,
        });
        expect(tileDress(apple, 'movies')).toMatchObject({
            tile: 'poster',
            large: false,
        });
        // Hulu's large tiles carry their names on the artwork.
        const hulu = platformDesign('hulu');
        expect(tileDress(hulu, 'series')).toMatchObject({
            large: true,
            caption: true,
        });
        expect(tileDress(hulu, 'movies')).toMatchObject({
            large: false,
            caption: false,
            sub: true,
        });
        expect(tileDress(platformDesign('disney-plus'), 'newest').tile).toBe(
            'landscape'
        );
        expect(tileDress(platformDesign('disney-plus'), 'series').tile).toBe(
            'poster'
        );
    });

    it('lays the open list out one size, its names under the art', () => {
        const hulu = platformDesign('hulu');

        expect(tileDress(hulu, 'series', true)).toMatchObject({
            tile: 'landscape',
            large: false,
            caption: false,
        });
        expect(
            tileDress(platformDesign('netflix'), 'series', true).caption
        ).toBe(true);
        expect(RANKED_DRESS).toMatchObject({ tile: 'poster', info: false });
    });

    it('quotes a label for a CSS content', () => {
        expect(cssString('Incluido con "Prime"\\')).toBe(
            '"Incluido con \\"Prime\\"\\\\"'
        );
    });
});
