import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import { catalogExtras } from './catalog-extras';
import { heroMeta, posterMeta, type MetaPart } from './catalog-meta';
import type { CatalogTitle } from './catalog-titles';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;

const title = (extra: Partial<CatalogTitle> = {}): CatalogTitle => ({
    id: 1,
    kind: 'movie',
    categoryId: '1610',
    title: 'EL ÚLTIMO FARO',
    poster: null,
    language: 'ES',
    added: 0,
    genres: [],
    rating: null,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: null,
    versions: [],
    platform: NETFLIX,
    platforms: [NETFLIX],
    ...extra,
});

/** A meta line as the template writes it, keys standing for their text. */
const line = (parts: MetaPart[]) =>
    parts
        .map((part) =>
            part
                .map((text) =>
                    text.key
                        ? `${text.key}${text.params ? JSON.stringify(text.params) : ''}`
                        : text.text
                )
                .join(', ')
        )
        .join(' · ');

describe('catalogExtras', () => {
    it("reads a movie's page: backdrop, year, genres and running time", () => {
        const extras = catalogExtras({
            info: {
                plot: ' Un farero. ',
                backdrop_path: ['', 'https://img/bd.jpg'],
                genre: 'Drama, Thriller',
                releasedate: '2025-03-14',
                duration: '01:52:00',
            },
            movie_data: { stream_id: 1 },
        });

        expect(extras).toEqual({
            plot: 'Un farero.',
            backdrop: 'https://img/bd.jpg',
            genres: ['Drama', 'Thriller'],
            year: 2025,
            minutes: 112,
            seasons: null,
        });
    });

    it('takes the running time in seconds or minutes too', () => {
        expect(catalogExtras({ info: { duration_secs: 5400 } }).minutes).toBe(
            90
        );
        expect(
            catalogExtras({ info: { episode_run_time: '48' } }).minutes
        ).toBe(48);
        expect(catalogExtras({ info: { duration: '00:00:00' } }).minutes).toBe(
            null
        );
    });

    it("counts a series' seasons with episodes", () => {
        expect(
            catalogExtras({
                info: { releaseDate: '2017' },
                episodes: { '1': [{}], '2': [{}, {}], '3': [] },
            })
        ).toMatchObject({ year: 2017, seasons: 2 });
        expect(
            catalogExtras({
                info: {},
                seasons: [{ season_number: 0 }, { season_number: 1 }],
                episodes: [],
            }).seasons
        ).toBe(1);
    });

    it('reads an answer it does not know as nothing', () => {
        expect(catalogExtras(null)).toEqual({
            plot: null,
            backdrop: null,
            genres: [],
            year: null,
            minutes: null,
            seasons: null,
        });
    });
});

describe('catalog meta lines', () => {
    it("writes the hero's kind, year, genres and length", () => {
        expect(
            line(
                heroMeta(title({ year: 2025, genres: ['drama', 'thriller'] }), {
                    ...catalogExtras({ info: { duration: '01:52' } }),
                })
            )
        ).toBe(
            'WORKSPACE.CATALOG.MOVIE · 2025 · ' +
                'WORKSPACE.PLATFORMS.GENRES.DRAMA, WORKSPACE.PLATFORMS.GENRES.THRILLER · ' +
                'WORKSPACE.CATALOG.DURATION_HM{"hours":1,"minutes":"52"}'
        );
    });

    it("falls back on the title page's year and genres", () => {
        const extras = catalogExtras({
            info: { releaseDate: '2024-01-01', genre: 'Crime / Drama' },
            episodes: { '1': [{}] },
        });

        expect(line(heroMeta(title({ kind: 'series' }), extras))).toBe(
            'WORKSPACE.CATALOG.SERIE · 2024 · Crime, Drama · WORKSPACE.CATALOG.SEASON_ONE'
        );
        expect(line(heroMeta(title({ kind: 'series' }), null))).toBe(
            'WORKSPACE.CATALOG.SERIE'
        );
    });

    it("names another genre than the row's under a poster", () => {
        const drama = title({
            year: 2024,
            genres: ['drama', 'crime'],
            rating: 7.84,
        });

        expect(line(posterMeta(drama, 'drama'))).toBe(
            '2024 · WORKSPACE.PLATFORMS.GENRES.CRIME · ★ 7.8'
        );
        expect(line(posterMeta(title({ genres: ['drama'] }), 'drama'))).toBe(
            'WORKSPACE.PLATFORMS.GENRES.DRAMA'
        );
        expect(line(posterMeta(title(), null))).toBe('Netflix');
    });
});
