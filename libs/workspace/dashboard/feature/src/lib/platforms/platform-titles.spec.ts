import {
    buildPlatformRows,
    mergePlatformTitles,
    toPlatformTitles,
    type PlatformTitle,
} from './platform-titles';
import type { PlatformCategory } from './streaming-platforms';

const movies: PlatformCategory = { id: '1610', kind: 'movie', language: 'ES' };
const shows: PlatformCategory = { id: '2331', kind: 'series', language: 'ES' };

describe('platform titles', () => {
    it('lists titles newest first, by name alone, once each', () => {
        const titles = mergePlatformTitles([
            toPlatformTitles(
                movies,
                [
                    {
                        stream_id: 7,
                        name: 'MUERTOS S.L. (2024) ES',
                        stream_icon: 'http://img/7.jpg',
                        added: '100',
                        category_ids: [1610, 11],
                    },
                    { stream_id: 'x', name: 'Broken' },
                ],
                new Map([['11', ['horror']]])
            ),
            toPlatformTitles(shows, [
                {
                    series_id: 3,
                    name: 'FAUDA (2015) ES',
                    cover: '',
                    last_modified: '200',
                    genre: 'Drama, Crimen',
                },
            ]),
            toPlatformTitles(movies, [
                { stream_id: 7, name: 'MUERTOS S.L. (2024) ES', added: '100' },
            ]),
        ]);

        expect(titles).toEqual([
            {
                id: 3,
                kind: 'series',
                categoryId: '2331',
                title: 'FAUDA',
                poster: null,
                language: 'ES',
                added: 200,
                genres: ['drama', 'crime'],
            },
            {
                id: 7,
                kind: 'movie',
                categoryId: '1610',
                title: 'MUERTOS S.L.',
                poster: 'http://img/7.jpg',
                language: 'ES',
                added: 100,
                genres: ['horror'],
            },
        ]);
    });

    it('lays out new titles, movies, series, then the largest genres', () => {
        const title = (
            id: number,
            kind: PlatformTitle['kind'],
            genres: PlatformTitle['genres']
        ): PlatformTitle => ({
            id,
            kind,
            categoryId: '1',
            title: `T${id}`,
            poster: null,
            language: 'EN',
            added: 1000 - id,
            genres,
        });
        const titles = [
            ...Array.from({ length: 8 }, (_, i) =>
                title(i, 'movie', ['horror'])
            ),
            ...Array.from({ length: 6 }, (_, i) =>
                title(10 + i, 'series', ['comedy', 'horror'])
            ),
            title(30, 'series', ['western']),
        ];

        const rows = buildPlatformRows(titles);

        expect(rows.map((row) => [row.id, row.titles.length])).toEqual([
            ['newest', 15],
            ['movies', 8],
            ['series', 7],
            ['genre-horror', 14],
            ['genre-comedy', 6],
        ]);
        expect(rows[3].labelKey).toBe('WORKSPACE.PLATFORMS.GENRES.HORROR');
    });
});
