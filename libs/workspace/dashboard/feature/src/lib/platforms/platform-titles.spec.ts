import {
    languagesLabel,
    languageVersions,
    toPlatformTitles,
    type PlatformTitle,
} from './platform-titles';
import type { PlatformCategory } from './streaming-platforms';

const movies: PlatformCategory = { id: '1610', kind: 'movie', language: 'ES' };
const shows: PlatformCategory = { id: '482', kind: 'series', language: 'EN' };

describe('platform titles', () => {
    it("reads a list's entries by name alone, with genres and versions", () => {
        const titles = toPlatformTitles(
            movies,
            [
                {
                    stream_id: 7,
                    name: 'MUERTOS S.L. (2024) ES',
                    stream_icon: 'http://img/7.jpg',
                    added: '100',
                    rating: '7.2',
                    category_ids: [1610, 11],
                    tmdb: '1234',
                },
                { stream_id: 'x', name: 'Broken' },
            ],
            new Map([['11', ['horror']]])
        );

        expect(titles).toEqual([
            {
                id: 7,
                kind: 'movie',
                categoryId: '1610',
                title: 'MUERTOS S.L.',
                poster: 'http://img/7.jpg',
                language: 'ES',
                added: 100,
                genres: ['horror'],
                rating: 7.2,
                plot: null,
                backdrop: null,
                tmdb: 1234,
                year: 2024,
                versions: [
                    {
                        id: 7,
                        categoryId: '1610',
                        language: 'ES',
                        title: 'MUERTOS S.L.',
                    },
                ],
            },
        ]);
    });

    it('reads the TMDB id and the year however the provider sends them', () => {
        const [fauda, gentlemen, norsemen, broken] = toPlatformTitles(shows, [
            {
                series_id: 1,
                name: 'Fauda',
                tmdb_id: 64230,
                releaseDate: '2015-02-15',
                genre: 'Drama, Crimen',
                last_modified: '200',
                backdrop_path: ['', 'https://img/b.jpg'],
            },
            { series_id: 2, name: 'THE GENTLEMEN [2024]', tmdb: ' 236235 ' },
            { series_id: 3, name: 'NORSEMEN (2016)_ENG', tmdb: '0' },
            { series_id: 4, name: 'EN - TONY - 2026', tmdb: 'n/a' },
        ]);

        expect([fauda.tmdb, fauda.year, fauda.genres]).toEqual([
            64230,
            2015,
            ['drama', 'crime'],
        ]);
        expect(fauda.backdrop).toBe('https://img/b.jpg');
        expect([gentlemen.tmdb, gentlemen.year]).toEqual([236235, 2024]);
        expect([norsemen.tmdb, norsemen.year]).toEqual([null, 2016]);
        expect([broken.title, broken.tmdb, broken.year]).toEqual([
            'TONY',
            null,
            2026,
        ]);
    });

    it('names the languages a title comes in, one version each', () => {
        const title = {
            language: 'ES',
            versions: [
                { id: 1, categoryId: '1', language: 'ES', title: 'Élite' },
                { id: 2, categoryId: '2', language: 'ES', title: 'Élite' },
                { id: 3, categoryId: '3', language: 'EN', title: 'Elite' },
            ],
        } as unknown as PlatformTitle;

        expect(languageVersions(title).map((version) => version.id)).toEqual([
            1, 3,
        ]);
        expect(languagesLabel(title)).toBe('ES · EN');
    });
});
