import { toPlatformTitles } from '../platforms/platform-titles';
import {
    storedPlatformLists,
    toStoredVodCatalog,
    withKnownGenres,
} from './catalog-stored-rows';
import { aggregateCatalog } from './catalog-titles';

/** SQLite category rows: their row id, and the provider's as `xtream_id`. */
const dbCategory = (id: number, xtreamId: number, name: string) => ({
    id,
    name,
    playlist_id: 'p1',
    type: 'movies' as const,
    xtream_id: xtreamId,
    hidden: false,
    locked: false,
});

describe('stored catalog rows', () => {
    it("reads Electron's rows: provider category ids, posters and dates", () => {
        const data = toStoredVodCatalog(
            [
                dbCategory(501, 1610, '|ES| ✪ ORIGINAL NETFLIX'),
                dbCategory(502, 1125, '|EN| ✪ Netflix MULTI SUB'),
                dbCategory(503, 1183, '|ES| ✪ DRAMA'),
                dbCategory(504, 9001, '|FR| ✪ NETFLIX'),
            ],
            [
                {
                    xtream_id: 7,
                    title: 'EL HOYO (2019) ES',
                    poster_url: 'http://img/7.jpg',
                    added: '1700000000',
                    rating: '7.1',
                    category_id: 501,
                },
                {
                    xtream_id: 8,
                    title: 'The Platform (2019)',
                    poster_url: 'http://img/7.jpg',
                    added: '1700000500',
                    category_id: 502,
                },
                {
                    xtream_id: 70,
                    title: 'EL HOYO (2019)',
                    poster_url: 'http://img/70.jpg',
                    category_id: 503,
                },
                // Not a kept language: left out.
                { xtream_id: 99, title: 'LA PLATEFORME', category_id: 504 },
            ],
            true
        );

        const lists = storedPlatformLists(data, 'movie');

        expect(lists.map((list) => list.platform.id)).toEqual(['netflix']);
        const [hoyo, platform] = lists[0].titles;
        expect(hoyo).toMatchObject({
            id: 7,
            kind: 'movie',
            categoryId: '1610',
            title: 'EL HOYO',
            poster: 'http://img/7.jpg',
            language: 'ES',
            added: 1700000000,
            rating: 7.1,
            year: 2019,
            // The same name in the source's |ES| DRAMA category.
            genres: ['drama'],
        });
        expect(platform).toMatchObject({ id: 8, language: 'EN', genres: [] });

        // The Spanish and English versions (one poster) are one title.
        const titles = aggregateCatalog(lists, 'movie');
        expect(titles).toHaveLength(1);
        expect(titles[0].versions.map((version) => version.id)).toEqual([7, 8]);
        expect(titles[0].added).toBe(1700000500);
    });

    it("reads the browser's session rows as the panel sent them", () => {
        const data = toStoredVodCatalog(
            [
                {
                    category_id: '2331',
                    category_name: '|ES| ✪ NETFLIX SERIES',
                    parent_id: 0,
                },
                {
                    category_id: '1720',
                    category_name: '|ES| ✪ DISNEY+',
                    parent_id: 0,
                },
                {
                    category_id: '1066',
                    category_name: '|EN| ✪ HORROR',
                    parent_id: 0,
                },
            ],
            [
                {
                    series_id: 5,
                    xtream_id: 5,
                    name: 'DARK',
                    cover: 'http://img/dark.jpg',
                    last_modified: '1700000100',
                    genre: 'Crimen, Drama, Misterio',
                    backdrop_path: ['http://img/dark-bd.jpg'],
                    plot: 'Un niño desaparece.',
                    releaseDate: '2017-12-01',
                    category_id: '2331',
                },
                {
                    series_id: 6,
                    xtream_id: 6,
                    name: 'LOKI',
                    cover: 'http://img/loki.jpg',
                    last_modified: '1700000200',
                    category_id: '1720',
                    category_ids: [1720, 1066],
                },
            ],
            false
        );

        const titles = aggregateCatalog(
            storedPlatformLists(data, 'series'),
            'series'
        );

        expect(titles.map((title) => [title.title, title.platform.id])).toEqual(
            [
                ['LOKI', 'disney-plus'],
                ['DARK', 'netflix'],
            ]
        );
        expect(titles[0].genres).toEqual(['horror']);
        expect(titles[1]).toMatchObject({
            genres: ['drama', 'crime', 'mystery'],
            backdrop: 'http://img/dark-bd.jpg',
            plot: 'Un niño desaparece.',
            year: 2017,
        });
    });

    it('lends a title the genres the platform pages loaded for it', () => {
        const data = toStoredVodCatalog(
            [dbCategory(501, 1610, '|ES| ✪ ORIGINAL NETFLIX')],
            [{ xtream_id: 7, title: 'EL HOYO', category_id: 501 }],
            true
        );
        const known = toPlatformTitles(
            { id: '1610', kind: 'movie', language: 'ES' },
            [{ stream_id: 7, name: 'EL HOYO', genre: 'Terror, Thriller' }]
        );

        const [list] = withKnownGenres(
            storedPlatformLists(data, 'movie'),
            () => known
        );

        expect(list.titles[0].genres).toEqual(['horror', 'thriller']);
    });

    it('files a row stored under a genre in the platforms that list it', () => {
        const data = toStoredVodCatalog(
            [
                dbCategory(601, 1270, '|EN| ✪ AMAZON-PRIME'),
                dbCategory(602, 482, '|EN| ✪ NETFLIX'),
                dbCategory(603, 577, '|EN| ✪ CRIME  DRAME THRILLER'),
            ],
            [
                // The import keeps one category per title: the genre's.
                { xtream_id: 5, title: 'The Boys', category_id: 603 },
                { xtream_id: 6, title: 'Dark', category_id: 602 },
            ],
            true
        );
        const members = new Map([['1270', new Set([5])]]);

        const without = storedPlatformLists(data, 'series');
        const lists = storedPlatformLists(data, 'series', members);

        expect(without.map((list) => list.titles.length)).toEqual([1, 0]);
        expect(
            lists.map((list) => [
                list.platform.id,
                list.titles.map((title) => title.title),
            ])
        ).toEqual([
            ['netflix', ['Dark']],
            ['prime-video', ['The Boys']],
        ]);
        // Its stored genre category still names its genres.
        expect(lists[1].titles[0].genres).toEqual(
            expect.arrayContaining(['crime', 'thriller'])
        );
        expect(
            aggregateCatalog(lists, 'series').map((title) => title.platform.id)
        ).toEqual(expect.arrayContaining(['netflix', 'prime-video']));
    });
});
