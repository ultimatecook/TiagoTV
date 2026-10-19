import { toPlatformTitles, type PlatformCatalogItem } from './platform-titles';
import { groupVersions, mergePlatformTitles } from './platform-versions';
import type { PlatformCategory } from './streaming-platforms';

const esMovies: PlatformCategory = {
    id: '1610',
    kind: 'movie',
    language: 'ES',
};
const enMovies: PlatformCategory = {
    id: '1125',
    kind: 'movie',
    language: 'EN',
};
const esShows: PlatformCategory = {
    id: '2331',
    kind: 'series',
    language: 'ES',
};
const enShows: PlatformCategory = { id: '482', kind: 'series', language: 'EN' };

const show = (
    id: number,
    name: string,
    extra: Partial<PlatformCatalogItem> = {}
): PlatformCatalogItem => ({
    series_id: id,
    name,
    cover: `http://img/${id}.jpg`,
    last_modified: String(1000 - id),
    ...extra,
});
const movie = (
    id: number,
    name: string,
    extra: Partial<PlatformCatalogItem> = {}
): PlatformCatalogItem => ({
    stream_id: id,
    name,
    stream_icon: `http://img/${id}.jpg`,
    added: String(1000 - id),
    ...extra,
});

describe('platform title versions', () => {
    it('shows one card for a show filed in Spanish and English', () => {
        // The Netflix page of the report: the same shows once per language.
        const titles = mergePlatformTitles([
            toPlatformTitles(esShows, [
                show(1, 'FAUDA (2015) ES', { tmdb: '64230' }),
                show(2, 'MUERTOS S.L. (2024) ES', {
                    cover: 'https://image.tmdb.org/t/p/w500/death.jpg',
                }),
                show(3, 'THE GENTLEMEN: LA SERIE (2024) ES', {
                    tmdb_id: 236235,
                }),
            ]),
            toPlatformTitles(enShows, [
                show(11, 'Fauda (2015)_ENG', { tmdb: 64230 }),
                show(12, 'NORSEMEN (2016)_ENG'),
                show(13, 'DEATH INC. (2024)_ENG', {
                    cover: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/death.jpg',
                    plot: 'A funeral home on the brink.',
                    rating: '7.4',
                }),
                show(14, 'THE GENTLEMEN (2024)_ENG', { tmdb: '236235' }),
            ]),
        ]);

        expect(titles.map((title) => title.title)).toEqual([
            'FAUDA',
            'MUERTOS S.L.',
            'THE GENTLEMEN: LA SERIE',
            'NORSEMEN',
        ]);
        const muertos = titles[1];
        expect(muertos).toMatchObject({
            id: 2,
            language: 'ES',
            categoryId: '2331',
            // The English version fills in what the Spanish one lacks.
            plot: 'A funeral home on the brink.',
            rating: 7.4,
        });
        expect(muertos.versions).toEqual([
            {
                id: 2,
                categoryId: '2331',
                language: 'ES',
                title: 'MUERTOS S.L.',
            },
            { id: 13, categoryId: '482', language: 'EN', title: 'DEATH INC.' },
        ]);
        expect(titles[0].versions.map((version) => version.id)).toEqual([
            1, 11,
        ]);
        expect(titles[2].versions.map((version) => version.id)).toEqual([
            3, 14,
        ]);
        expect(titles[3].versions.map((version) => version.language)).toEqual([
            'EN',
        ]);
    });

    it('prefers the Spanish version, newest added and genres of both', () => {
        const [title] = mergePlatformTitles([
            toPlatformTitles(enMovies, [
                movie(5, 'RED NOTICE (2021)_ENG', {
                    stream_icon: 'http://img/red.jpg',
                    added: '900',
                    genre: 'Comedy',
                }),
            ]),
            toPlatformTitles(esMovies, [
                movie(6, 'ALERTA ROJA (2021) ES', {
                    stream_icon: 'http://img/red.jpg?v=2',
                    added: '500',
                    genre: 'Acción',
                }),
            ]),
        ]);

        expect(title).toMatchObject({
            id: 6,
            title: 'ALERTA ROJA',
            language: 'ES',
            added: 900,
            genres: ['action', 'comedy'],
        });
        expect(title.versions.map((version) => version.language)).toEqual([
            'ES',
            'EN',
        ]);
    });

    it('lists a title filed in two categories once, newest first', () => {
        const titles = mergePlatformTitles([
            toPlatformTitles(esMovies, [movie(7, 'MUERTOS S.L. (2024) ES')]),
            toPlatformTitles(esShows, [show(3, 'FAUDA (2015) ES')]),
            toPlatformTitles(esMovies, [movie(7, 'MUERTOS S.L. (2024) ES')]),
        ]);

        expect(titles.map((title) => [title.kind, title.id])).toEqual([
            ['series', 3],
            ['movie', 7],
        ]);
        expect(titles[1].versions).toHaveLength(1);
    });

    it('keeps apart what only looks alike', () => {
        const placeholder = 'http://img/no-poster.png';
        const titles = [
            ...toPlatformTitles(esMovies, [
                // Same poster, different TMDB ids.
                movie(1, 'DUNE (2021) ES', { tmdb: 438631, stream_icon: 'p' }),
                movie(2, 'DUNE: PARTE DOS (2024) ES', {
                    tmdb: 693134,
                    stream_icon: 'p',
                }),
                // Same name, years apart: a remake.
                movie(3, 'REBECCA (1940) ES'),
                movie(4, 'REBECCA (2020) ES'),
                // The provider's placeholder poster, on many titles.
                ...[10, 11, 12, 13, 14, 15, 16].map((id) =>
                    movie(id, `TITLE ${id} ES`, { stream_icon: placeholder })
                ),
            ]),
            // A series with a movie's TMDB number is another title.
            ...toPlatformTitles(enShows, [
                show(20, 'DUNE: PROPHECY', { tmdb: 438631 }),
            ]),
        ];

        expect(groupVersions(titles).every((group) => group.length === 1)).toBe(
            true
        );
    });

    it('does not chain a name across years through an undated entry', () => {
        const groups = groupVersions(
            toPlatformTitles(esMovies, [
                movie(1, 'REBECCA (1940) ES'),
                movie(2, 'REBECCA'),
                movie(3, 'REBECCA (2020) ES'),
                movie(4, 'Rebecca [2020]'),
            ])
        );

        expect(groups.map((group) => group.map((title) => title.id))).toEqual([
            [1, 2],
            [3, 4],
        ]);
    });
});
