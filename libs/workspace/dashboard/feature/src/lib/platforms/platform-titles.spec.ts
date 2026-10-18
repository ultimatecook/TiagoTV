import {
    buildPlatformRows,
    mergePlatformTitles,
    toPlatformTitles,
    topRated,
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
                rating: null,
                plot: null,
                backdrop: null,
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
                rating: null,
                plot: null,
                backdrop: null,
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
            rating: null,
            plot: null,
            backdrop: null,
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

    describe('Top 10', () => {
        const rated = (
            id: number,
            rating: number | null,
            poster: string | null = `http://img/${id}.jpg`
        ): PlatformTitle => ({
            id,
            kind: id % 2 ? 'movie' : 'series',
            categoryId: '1',
            title: `T${id}`,
            poster,
            language: 'ES',
            added: 1000 - id,
            genres: [],
            rating,
            plot: null,
            backdrop: null,
        });

        it('ranks the best rated with a poster, the newest on a tie', () => {
            const titles = [
                rated(1, 6),
                rated(2, 9.1),
                rated(3, null),
                rated(4, 9.5, null),
                rated(5, 7.2),
                rated(6, 9.1),
                ...Array.from({ length: 12 }, (_, i) => rated(10 + i, 5)),
            ];

            const top = topRated(titles);

            expect(top).toHaveLength(10);
            expect(top.slice(0, 4).map((title) => title.id)).toEqual([
                2, 6, 5, 1,
            ]);
            expect(top.map((title) => title.id)).not.toContain(3);
            expect(top.map((title) => title.id)).not.toContain(4);
        });

        it('adds a ranked row after the newest only when asked', () => {
            const titles = Array.from({ length: 12 }, (_, i) =>
                rated(i + 1, 5 + i / 4)
            );

            expect(buildPlatformRows(titles).some((row) => row.ranked)).toBe(
                false
            );

            const rows = buildPlatformRows(titles, { top10Of: 'Netflix' });

            expect(rows.map((row) => row.id).slice(0, 2)).toEqual([
                'newest',
                'top10',
            ]);
            expect(rows[1]).toMatchObject({
                labelKey: 'WORKSPACE.PLATFORMS.TOP10',
                labelParams: { platform: 'Netflix' },
                ranked: true,
            });
            expect(rows[1].titles[0].id).toBe(12);
        });

        it('leaves the row out when too few titles are rated', () => {
            const rows = buildPlatformRows([rated(1, 8), rated(2, null)], {
                top10Of: 'Netflix',
            });

            expect(rows.map((row) => row.id)).not.toContain('top10');
        });
    });
});
