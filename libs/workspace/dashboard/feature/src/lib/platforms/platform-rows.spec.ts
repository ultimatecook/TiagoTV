import type { PlatformGenre } from './platform-genres';
import { buildPlatformRows, topRated, type PlatformRow } from './platform-rows';
import { titleKey, type PlatformTitle } from './platform-titles';

const title = (
    id: number,
    kind: PlatformTitle['kind'],
    genres: readonly PlatformGenre[] = [],
    rating: number | null = null,
    poster: string | null = `http://img/${id}.jpg`
): PlatformTitle => ({
    id,
    kind,
    categoryId: '1',
    title: `T${id}`,
    poster,
    language: 'ES',
    added: 10000 - id,
    genres,
    rating,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: null,
    versions: [{ id, categoryId: '1', language: 'ES', title: `T${id}` }],
});

const GENRES: readonly PlatformGenre[] = [
    'drama',
    'comedy',
    'crime',
    'action',
    'horror',
];

/** A large catalog, newest first: movies and series, rated and genred. */
function catalog(size = 400): PlatformTitle[] {
    return Array.from({ length: size }, (_, i) =>
        title(
            i + 1,
            i % 3 ? 'movie' : 'series',
            [...new Set([GENRES[i % 5], GENRES[(i * 7 + 2) % 5]])],
            i % 4 ? 5 + ((i * 37) % 45) / 10 : null
        )
    );
}

const ids = (row: PlatformRow) => row.titles.map((item) => item.id);

/** How many places (rows, and the hero) each title takes on the page. */
function places(rows: readonly PlatformRow[], hero: readonly PlatformTitle[]) {
    const count = new Map<string, number>();
    for (const list of [hero, ...rows.map((row) => row.titles)]) {
        for (const item of list) {
            count.set(titleKey(item), (count.get(titleKey(item)) ?? 0) + 1);
        }
    }
    return count;
}

describe('platform rows', () => {
    it('lays out new titles, movies, series, then the largest genres', () => {
        const titles = catalog();
        const movies = titles.filter((item) => item.kind === 'movie');

        const rows = buildPlatformRows(titles, { seed: 20380 });

        expect(rows.slice(0, 3).map((row) => row.id)).toEqual([
            'newest',
            'movies',
            'series',
        ]);
        expect(ids(rows[0])).toEqual(
            titles.slice(0, 30).map((item) => item.id)
        );
        expect(rows[1].titles).toHaveLength(40);
        expect(rows[1].titles.every((item) => item.kind === 'movie')).toBe(
            true
        );
        // "See all" opens every movie, in the row's order.
        expect(rows[1].all).toHaveLength(movies.length);
        const genres = rows.slice(3);
        expect(genres.length).toBeGreaterThan(0);
        expect(genres[0].labelKey).toMatch(/^WORKSPACE\.PLATFORMS\.GENRES\./);
        const sizes = genres.map((row) => row.all?.length ?? 0);
        expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    });

    it('shows a small catalog in what is new alone, not twice', () => {
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
        ]);
    });

    it('shows a mid-size series-only platform by genre, not in two rows', () => {
        // Hulu or Apple TV: 74 series, no movies.
        const titles = catalog(222).filter((item) => item.kind === 'series');
        expect(titles).toHaveLength(74);
        const hero = titles.slice(0, 6);

        const rows = buildPlatformRows(titles, { hero, seed: 20380 });

        expect(rows[0].id).toBe('newest');
        expect(
            rows.filter((row) => row.id.startsWith('genre-')).length
        ).toBeGreaterThanOrEqual(2);
        expect(Math.max(...places(rows, hero).values())).toBeLessThanOrEqual(2);
    });

    it('keeps the hero out of the rows beside it, a title in two places', () => {
        const titles = catalog();
        const hero = [titles[0], titles[1], titles[5]];

        const rows = buildPlatformRows(titles, {
            top10Of: 'Netflix',
            hero,
            seed: 20380,
        });

        expect(rows.slice(0, 2).map((row) => row.id)).toEqual([
            'newest',
            'top10',
        ]);
        for (const row of rows.slice(0, 2)) {
            for (const item of hero) {
                expect(ids(row)).not.toContain(item.id);
            }
        }
        expect(Math.max(...places(rows, hero).values())).toBeLessThanOrEqual(2);
        expect(new Set(ids(rows[1])).size).toBe(rows[1].titles.length);
    });

    it('fills a genre row with that genre only, opening on new titles', () => {
        const titles = catalog();
        const rows = buildPlatformRows(titles, { seed: 20380 });
        const genreRows = rows.filter((row) => row.id.startsWith('genre-'));

        expect(genreRows.length).toBeGreaterThan(0);
        const shownAbove = new Set<string>();
        for (const row of rows) {
            if (row.id.startsWith('genre-')) {
                const genre = row.id.replace('genre-', '') as PlatformGenre;
                expect(
                    row.titles.every((item) => item.genres.includes(genre))
                ).toBe(true);
                expect(
                    row.titles
                        .slice(0, 6)
                        .some((item) => shownAbove.has(titleKey(item)))
                ).toBe(false);
            }
            row.titles.forEach((item) => shownAbove.add(titleKey(item)));
        }
    });

    it('opens each row on titles of its own', () => {
        const rows = buildPlatformRows(catalog(), {
            top10Of: 'Netflix',
            seed: 20380,
        });
        const openings = rows
            .filter((row) => !row.ranked)
            .map((row) => ids(row).slice(0, 6));

        const all = openings.reduce<number[]>(
            (list, opening) => [...list, ...opening],
            []
        );
        expect(new Set(all).size).toBe(all.length);
        // Only "new" goes by date.
        expect(openings[0]).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('mixes the rows by the day, the same all day long', () => {
        const titles = catalog();
        const today = buildPlatformRows(titles, { seed: 20380 });
        const again = buildPlatformRows(titles, { seed: 20380 });
        const tomorrow = buildPlatformRows(titles, { seed: 20381 });
        const movies = (rows: PlatformRow[]) =>
            ids(rows.find((row) => row.id === 'movies') as PlatformRow);

        expect(movies(again)).toEqual(movies(today));
        expect(movies(tomorrow)).not.toEqual(movies(today));
        expect(ids(tomorrow[0])).toEqual(ids(today[0]));
    });

    describe('Top 10', () => {
        it('ranks the best rated with a poster, the newest on a tie', () => {
            const titles = [
                title(1, 'movie', [], 6),
                title(2, 'series', [], 9.1),
                title(3, 'movie', [], null),
                title(4, 'series', [], 9.5, null),
                title(5, 'movie', [], 7.2),
                title(6, 'series', [], 9.1),
                ...Array.from({ length: 12 }, (_, i) =>
                    title(10 + i, 'series', [], 5)
                ),
            ];

            const top = topRated(titles);

            expect(top).toHaveLength(10);
            expect(top.slice(0, 4).map((item) => item.id)).toEqual([
                2, 6, 5, 1,
            ]);
            expect(top.map((item) => item.id)).not.toContain(3);
            expect(top.map((item) => item.id)).not.toContain(4);
        });

        it('adds a ranked row after the newest only when asked', () => {
            const titles = Array.from({ length: 12 }, (_, i) =>
                title(i + 1, 'movie', [], 5 + i / 4)
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
            const rows = buildPlatformRows(
                [title(1, 'movie', [], 8), title(2, 'movie', [], null)],
                { top10Of: 'Netflix' }
            );

            expect(rows.map((row) => row.id)).not.toContain('top10');
        });
    });
});
