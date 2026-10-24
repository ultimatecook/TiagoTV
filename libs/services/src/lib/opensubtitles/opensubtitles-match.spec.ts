import {
    buildSearchQueries,
    pickBestSubtitle,
    searchLanguages,
    subtitleCacheKey,
} from './opensubtitles-match';
import { result } from './opensubtitles.test-helpers';

describe('OpenSubtitles matching', () => {
    it('asks for every Spanish code, the chosen one first', () => {
        expect(searchLanguages('es')).toEqual(['es', 'sp', 'ea']);
        expect(searchLanguages('ea')).toEqual(['ea', 'es', 'sp']);
        expect(searchLanguages('pt-BR')).toEqual(['pt-br']);
    });

    it('builds the most precise queries first, keys sorted, values lowercased', () => {
        const queries = buildSearchQueries(
            {
                kind: 'movie',
                title: 'ES - Death Inc. (2024)',
                year: 2024,
                tmdbId: 5,
                imdbId: 'tt0012345',
            },
            ['es', 'ea']
        );

        expect(queries).toEqual([
            { languages: 'ea,es', tmdb_id: '5', type: 'movie' },
            { imdb_id: '12345', languages: 'ea,es', type: 'movie' },
            {
                languages: 'ea,es',
                query: 'death inc.',
                type: 'movie',
                year: '2024',
            },
        ]);
        for (const query of queries) {
            expect(Object.keys(query)).toEqual(Object.keys(query).sort());
        }
    });

    it('asks nothing for an episode without its season and number', () => {
        expect(
            buildSearchQueries({ kind: 'episode', title: 'Show', season: 1 }, [
                'es',
            ])
        ).toEqual([]);
    });

    it('prefers a full, human, trusted, popular subtitle in the first language', () => {
        const lookup = { kind: 'movie' as const, title: 'X', year: 2020 };
        const results = [
            result(1, { language: 'ea', download_count: 99999 }),
            result(2, { foreign_parts_only: true, download_count: 99999 }),
            result(3, { ai_translated: true, download_count: 5000 }),
            result(4, { hearing_impaired: true, download_count: 4000 }),
            result(5, { download_count: 10 }),
            result(6, { download_count: 10, from_trusted: true }),
            result(7, {
                feature_details: { year: 1999 },
                download_count: 999999,
            }),
        ];

        expect(pickBestSubtitle(results, ['es', 'ea'], lookup)).toEqual({
            fileId: 6,
            language: 'es',
            release: 'Release 6',
        });
        expect(
            pickBestSubtitle([results[0]], ['es', 'ea'], lookup)?.fileId
        ).toBe(1);
        expect(pickBestSubtitle([results[6]], ['es'], lookup)).toBeNull();
        expect(pickBestSubtitle([], ['es'], lookup)).toBeNull();
    });

    it('keys the cache by title id, episode and language', () => {
        expect(
            subtitleCacheKey({ kind: 'movie', title: 'X', tmdbId: 9 }, 'ES')
        ).toBe('movie:tmdb:9:es');
        expect(
            subtitleCacheKey(
                {
                    kind: 'episode',
                    title: 'X',
                    imdbId: 'tt0000042',
                    season: 1,
                    episode: 2,
                },
                'en'
            )
        ).toBe('episode:imdb:42:s1e2:en');
        expect(
            subtitleCacheKey(
                { kind: 'movie', title: 'EN - Fauda', year: 2015 },
                'es'
            )
        ).toBe('movie:name:fauda:2015:es');
    });
});
