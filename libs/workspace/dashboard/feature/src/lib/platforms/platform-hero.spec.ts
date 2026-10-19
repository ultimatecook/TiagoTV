import { pickRecommendations, titleExtras } from './platform-hero';
import type { PlatformTitle } from './platform-titles';

const title = (
    id: number,
    kind: PlatformTitle['kind'],
    rating: number | null,
    poster: string | null = `http://img/${id}.jpg`
): PlatformTitle => ({
    id,
    kind,
    categoryId: '1',
    title: `T${id}`,
    poster,
    language: 'ES',
    added: 1000 - id,
    genres: [],
    rating,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: null,
    versions: [],
});

describe('platform hero', () => {
    const titles = [
        title(1, 'movie', 5),
        title(2, 'movie', 8.1),
        title(3, 'series', 7.4),
        title(4, 'movie', 9, null),
        title(5, 'series', 8.8),
        title(6, 'movie', 7),
        title(7, 'series', 6.9),
        title(8, 'movie', 9.4),
        title(9, 'series', 7.7),
        title(10, 'movie', 6.6),
        title(11, 'series', null),
    ];

    it('recommends the well rated with artwork, movies and series in turn', () => {
        const picked = pickRecommendations(titles, 4, 20380);

        expect(picked.map((item) => item.kind)).toEqual([
            'movie',
            'series',
            'movie',
            'series',
        ]);
        for (const item of picked) {
            expect(item.rating).toBeGreaterThanOrEqual(6.5);
            expect(item.poster).not.toBeNull();
        }
    });

    it("draws the day's picks: the same all day, others the next", () => {
        const day = (seed: number) =>
            pickRecommendations(titles, 4, seed).map((item) => item.id);

        expect(day(20380)).toEqual(day(20380));
        const days = new Set(
            [20380, 20381, 20382, 20383, 20384].map((seed) => day(seed).join())
        );
        expect(days.size).toBeGreaterThan(1);
    });

    it('falls back to the unrated titles when none is rated', () => {
        const picked = pickRecommendations(
            [title(1, 'movie', null), title(2, 'movie', null)],
            4
        );

        expect(picked.map((item) => item.id).sort()).toEqual([1, 2]);
    });

    it("reads a title page's synopsis, backdrop and genres", () => {
        expect(
            titleExtras({
                plot: ' A heist. ',
                backdrop_path: ['', 'https://img/b.jpg'],
                genre: 'Drama, Crimen / Thriller, Extra',
            })
        ).toEqual({
            plot: 'A heist.',
            backdrop: 'https://img/b.jpg',
            genres: ['Drama', 'Crimen', 'Thriller'],
        });
        expect(titleExtras([])).toEqual({
            plot: null,
            backdrop: null,
            genres: [],
        });
    });
});
