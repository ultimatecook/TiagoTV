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
});

describe('platform hero', () => {
    it('recommends the best rated, movies and series in turn', () => {
        const picked = pickRecommendations(
            [
                title(1, 'movie', 5),
                title(2, 'movie', 8.1),
                title(3, 'series', 7.4),
                title(4, 'movie', 9, null),
                title(5, 'series', 8.8),
                title(6, 'movie', 7),
            ],
            4
        );

        expect(picked.map((item) => item.id)).toEqual([2, 5, 6, 3]);
    });

    it('falls back to the newest titles when none is rated', () => {
        const picked = pickRecommendations(
            [title(1, 'movie', null), title(2, 'movie', null)],
            4
        );

        expect(picked.map((item) => item.id)).toEqual([1, 2]);
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
