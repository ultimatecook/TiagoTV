import type { CatalogTitle } from '../catalog/catalog-titles';
import type { PlatformTitle } from '../platforms/platform-titles';
import {
    STREAMING_PLATFORMS,
    type PlatformShelf,
} from '../platforms/streaming-platforms';
import {
    metaLine,
    pickSeriesForYou,
    platformOfCategory,
    rankTopMovies,
    seriesBadge,
    seriesName,
    TOP_MOVIES_COUNT,
} from './home-platform-titles';

const [netflix] = STREAMING_PLATFORMS;
const NOW = new Date('2026-10-19T12:00:00Z');
const DAY = 24 * 60 * 60;
const nowS = NOW.getTime() / 1000;

const title = (
    id: number,
    overrides: Partial<PlatformTitle> = {}
): PlatformTitle => ({
    id,
    kind: 'movie',
    categoryId: '1',
    title: `Title ${id}`,
    poster: `http://img/${id}.jpg`,
    language: 'ES',
    added: 10_000 - id,
    genres: [],
    rating: null,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: null,
    versions: [],
    ...overrides,
});

/** A catalog title of Netflix (`CatalogService` titles, newest first). */
const entry = (
    id: number,
    overrides: Partial<PlatformTitle> = {}
): CatalogTitle => ({
    ...title(id, overrides),
    platform: netflix,
    platforms: [netflix],
});

describe('platformOfCategory', () => {
    const shelves: PlatformShelf[] = [
        {
            platform: netflix,
            categories: [
                { id: '10', kind: 'movie', language: 'ES' },
                { id: '20', kind: 'series', language: 'EN' },
            ],
        },
    ];

    it('finds the platform of a category of the same kind', () => {
        expect(platformOfCategory(shelves, 'movie', '10')).toBe(netflix);
        expect(platformOfCategory(shelves, 'series', 20)).toBe(netflix);
    });

    it('never mixes up a movie and a series category with one id', () => {
        expect(platformOfCategory(shelves, 'series', '10')).toBeNull();
        expect(platformOfCategory(shelves, 'live', '10')).toBeNull();
        expect(platformOfCategory(shelves, 'movie', null)).toBeNull();
    });
});

describe('rankTopMovies', () => {
    it('ranks the rated movies with a poster first, then the newest unrated', () => {
        const top = rankTopMovies([
            entry(1, { rating: 6 }),
            entry(2),
            entry(3, { rating: 9 }),
            entry(4, { rating: 8, poster: null }),
            entry(5, { rating: 10, kind: 'series' }),
        ]);

        // The day's draw moves a rating by under two points: 9 stays ahead.
        expect(top.map((movie) => movie.id)).toEqual([3, 1, 2]);
    });

    it('lists ten at most', () => {
        const titles = Array.from({ length: 30 }, (_, i) =>
            entry(i + 1, { rating: 5 + (i % 5) })
        );
        const top = rankTopMovies(titles);
        expect(top).toHaveLength(TOP_MOVIES_COUNT);
        // The catalog's own titles, platform and all.
        expect(top[0].platform).toBe(netflix);
    });
});

describe('pickSeriesForYou', () => {
    it('features a show with a backdrop and a synopsis, two more beside it', () => {
        const picks = pickSeriesForYou([
            entry(1, { kind: 'series', rating: 9 }),
            entry(2, {
                kind: 'series',
                rating: 7,
                backdrop: 'http://img/b2.jpg',
                plot: 'A plot.',
            }),
            entry(3, { kind: 'series', rating: 8 }),
            entry(4, { kind: 'movie', rating: 10 }),
        ]);

        expect(picks[0].id).toBe(2);
        expect(picks).toHaveLength(3);
        expect(picks.every((series) => series.kind === 'series')).toBe(true);
    });

    it('picks nothing without series', () => {
        expect(pickSeriesForYou([entry(1)])).toEqual([]);
    });
});

describe('metaLine', () => {
    it("reads translated and plain parts, a part's texts comma-joined", () => {
        expect(
            metaLine(
                [
                    [{ key: null, text: '2024' }],
                    [
                        { key: 'GENRE.CRIME', text: '' },
                        { key: 'GENRE.THRILLER', text: '' },
                    ],
                    [{ key: 'SEASONS', text: '', params: { count: 2 } }],
                ],
                (key, params) => (params ? `${key}:${params['count']}` : key)
            )
        ).toEqual(['2024', 'GENRE.CRIME, GENRE.THRILLER', 'SEASONS:2']);
    });
});

describe('seriesBadge', () => {
    const show = (overrides: Partial<PlatformTitle>) =>
        title(1, { kind: 'series', ...overrides });

    it('calls a show of this year added this month a premiere', () => {
        expect(
            seriesBadge(show({ year: 2026, added: nowS - 10 * DAY }), NOW)
        ).toEqual({ kind: 'premiere' });
    });

    it('names a later season added this month', () => {
        expect(
            seriesBadge(
                show({
                    title: 'The Show Season 2',
                    year: 2024,
                    added: nowS - 3 * DAY,
                }),
                NOW
            )
        ).toEqual({ kind: 'season', season: 2 });
    });

    it('says "new episode" for an older show updated this week', () => {
        expect(
            seriesBadge(show({ year: 2023, added: nowS - 2 * DAY }), NOW)
        ).toEqual({ kind: 'new-episode' });
        expect(
            seriesBadge(show({ year: 2023, added: nowS - 12 * DAY }), NOW)
        ).toBeNull();
    });

    it('gives nothing the data does not support', () => {
        expect(seriesBadge(show({ year: null, added: nowS }), NOW)).toBeNull();
        expect(seriesBadge(show({ year: 2026, added: 0 }), NOW)).toBeNull();
        expect(
            seriesBadge(show({ year: 2026, added: nowS - 90 * DAY }), NOW)
        ).toBeNull();
        expect(
            seriesBadge(title(1, { year: 2026, added: nowS }), NOW)
        ).toBeNull();
    });

    it('shows a series by its name without the season marker', () => {
        expect(seriesName(show({ title: 'The Show Season 2' }))).toBe(
            'The Show'
        );
    });
});
