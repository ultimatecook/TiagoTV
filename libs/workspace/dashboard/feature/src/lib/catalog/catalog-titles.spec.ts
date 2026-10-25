import {
    toPlatformTitles,
    type PlatformCatalogItem,
    type PlatformTitle,
} from '../platforms/platform-titles';
import {
    findStreamingPlatform,
    type PlatformCategory,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import {
    aggregateCatalog,
    buildCatalogRows,
    featuredTitle,
    MAX_ROW_TITLES,
    pickNewReleases,
    type CatalogTitle,
    type PlatformTitleList,
} from './catalog-titles';

const platform = (id: string): StreamingPlatform =>
    findStreamingPlatform(id) as StreamingPlatform;
const NETFLIX = platform('netflix');
const HBO = platform('hbo-max');
const PRIME = platform('prime-video');

const category = (
    id: string,
    kind: 'movie' | 'series',
    language: 'ES' | 'EN'
): PlatformCategory => ({ id, kind, language });

const show = (
    id: number,
    name: string,
    added: number,
    extra: Partial<PlatformCatalogItem> = {}
): PlatformCatalogItem => ({
    series_id: id,
    name,
    cover: `http://img/s${id}.jpg`,
    last_modified: String(added),
    ...extra,
});

const movie = (
    id: number,
    name: string,
    added: number,
    extra: Partial<PlatformCatalogItem> = {}
): PlatformCatalogItem => ({
    stream_id: id,
    name,
    stream_icon: `http://img/m${id}.jpg`,
    added: String(added),
    ...extra,
});

const list = (
    on: StreamingPlatform,
    ...titles: PlatformTitle[][]
): PlatformTitleList => ({
    platform: on,
    titles: titles.reduce<PlatformTitle[]>((all, part) => all.concat(part), []),
});

describe('aggregateCatalog', () => {
    it('merges a show across languages and platforms into one title', () => {
        const titles = aggregateCatalog(
            [
                list(
                    NETFLIX,
                    toPlatformTitles(category('482', 'series', 'EN'), [
                        show(11, 'DEATH INC. (2024)_ENG', 300, {
                            tmdb: '1001',
                            genre: 'Comedy',
                        }),
                    ]),
                    toPlatformTitles(category('2331', 'series', 'ES'), [
                        show(1, 'MUERTOS S.L. (2024) ES', 200, {
                            tmdb: '1001',
                        }),
                    ])
                ),
                list(
                    HBO,
                    toPlatformTitles(category('483', 'series', 'EN'), [
                        show(21, 'Death Inc. (2024)', 100, {
                            genre: 'Drama',
                        }),
                    ])
                ),
            ],
            'series'
        );

        expect(titles).toHaveLength(1);
        const [title] = titles;
        // In Spanish, attributed to the platform of the Spanish version.
        expect(title.title).toBe('MUERTOS S.L.');
        expect(title.platform.id).toBe('netflix');
        expect(title.platforms.map((item) => item.id)).toEqual([
            'netflix',
            'hbo-max',
        ]);
        expect(title.genres).toEqual(['comedy', 'drama']);
        expect(title.versions.map((version) => version.id)).toEqual([
            1, 11, 21,
        ]);
        // The newest of its versions dates it.
        expect(title.added).toBe(300);
    });

    it('keeps the titles of the kind asked for, newest first', () => {
        const titles = aggregateCatalog(
            [
                list(
                    NETFLIX,
                    toPlatformTitles(category('1610', 'movie', 'ES'), [
                        movie(1, 'EL HOYO (2019)', 50),
                        movie(2, 'ROMA (2018)', 70),
                    ]),
                    toPlatformTitles(category('2331', 'series', 'ES'), [
                        show(3, 'ÉLITE (2018)', 90),
                    ])
                ),
                list(
                    PRIME,
                    toPlatformTitles(category('77', 'movie', 'EN'), [
                        movie(4, 'Saltburn (2023)', 60),
                    ])
                ),
            ],
            'movie'
        );

        expect(titles.map((title) => title.title)).toEqual([
            'ROMA',
            'Saltburn',
            'EL HOYO',
        ]);
        expect(titles.map((title) => title.platform.id)).toEqual([
            'netflix',
            'prime-video',
            'netflix',
        ]);
    });

    it('lists a stream filed on two platforms once', () => {
        const titles = aggregateCatalog(
            [
                list(
                    NETFLIX,
                    toPlatformTitles(category('1610', 'movie', 'ES'), [
                        movie(9, 'EL HOYO (2019)', 50),
                    ])
                ),
                list(
                    HBO,
                    toPlatformTitles(category('600', 'movie', 'ES'), [
                        movie(9, 'EL HOYO (2019)', 50),
                    ])
                ),
            ],
            'movie'
        );

        expect(titles).toHaveLength(1);
        expect(titles[0].platform.id).toBe('netflix');
    });

    it('never joins two titles whose years disagree', () => {
        const titles = aggregateCatalog(
            [
                list(
                    NETFLIX,
                    toPlatformTitles(category('1610', 'movie', 'ES'), [
                        movie(1, 'DUNE (1984)', 50),
                    ])
                ),
                list(
                    HBO,
                    toPlatformTitles(category('600', 'movie', 'ES'), [
                        movie(2, 'DUNE (2021)', 40),
                    ])
                ),
            ],
            'movie'
        );

        expect(titles.map((title) => title.year)).toEqual([1984, 2021]);
    });
});

const titled = (
    id: number,
    on: StreamingPlatform,
    added: number,
    extra: Partial<CatalogTitle> = {}
): CatalogTitle => ({
    id,
    kind: 'movie',
    categoryId: '1',
    title: `T${id}`,
    poster: `http://img/${id}.jpg`,
    language: 'ES',
    added,
    genres: [],
    rating: null,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: null,
    versions: [],
    platform: on,
    platforms: [on],
    ...extra,
});

describe('pickNewReleases', () => {
    it('lets the platforms take turns, the newest platform first', () => {
        const titles = [
            titled(1, NETFLIX, 100),
            titled(2, NETFLIX, 99),
            titled(3, NETFLIX, 98),
            titled(4, HBO, 97),
            titled(5, PRIME, 96),
            titled(6, HBO, 95),
        ];

        expect(pickNewReleases(titles, 5).map((title) => title.id)).toEqual([
            1, 4, 5, 2, 6,
        ]);
    });

    it('leaves out titles without artwork while enough have it', () => {
        const titles = [
            titled(1, NETFLIX, 100, { poster: null }),
            titled(2, HBO, 99),
            titled(3, PRIME, 98, { poster: null, backdrop: 'http://bd/3' }),
        ];

        expect(pickNewReleases(titles, 2).map((title) => title.id)).toEqual([
            2, 3,
        ]);
        expect(pickNewReleases(titles, 3).map((title) => title.id)).toEqual([
            1, 2, 3,
        ]);
    });
});

describe('buildCatalogRows', () => {
    it('shows a genre with two titles or more, in the page order', () => {
        const rows = buildCatalogRows([
            titled(1, NETFLIX, 100, { genres: ['drama', 'comedy'] }),
            titled(2, HBO, 90, { genres: ['drama'] }),
            titled(3, PRIME, 80, { genres: ['horror'] }),
            titled(4, PRIME, 70, { genres: ['comedy', 'action'] }),
            titled(5, NETFLIX, 60, { genres: ['action'] }),
        ]);

        expect(rows.map((row) => row.id)).toEqual([
            'action',
            'comedy',
            'drama',
        ]);
        expect(rows[1].titles.map((title) => title.id)).toEqual([1, 4]);
        expect(rows.every((row) => row.platform === null)).toBe(true);
    });

    it("keeps a row's newest titles", () => {
        const titles = Array.from({ length: MAX_ROW_TITLES + 5 }, (_, i) =>
            titled(i + 1, NETFLIX, 1000 - i, { genres: ['drama'] })
        );

        const [row] = buildCatalogRows(titles);

        expect(row.titles).toHaveLength(MAX_ROW_TITLES);
        expect(row.titles[0].id).toBe(1);
    });

    it('falls back to a row per platform where no genre is known', () => {
        const rows = buildCatalogRows([
            titled(1, NETFLIX, 100),
            titled(2, HBO, 90),
            titled(3, NETFLIX, 80),
            titled(4, HBO, 70),
            titled(5, PRIME, 60),
        ]);

        expect(rows.map((row) => row.id)).toEqual(['netflix', 'hbo-max']);
        expect(rows[0].platform?.name).toBe('Netflix');
        expect(rows[0].genre).toBeNull();
    });
});

describe('featuredTitle', () => {
    it('features the picked title, else the first release', () => {
        const titles = [
            titled(1, NETFLIX, 3),
            titled(2, HBO, 2),
            titled(3, PRIME, 1),
        ];
        const releases = titles.slice(0, 2);

        expect(featuredTitle(releases, titles, 'movie:2')?.id).toBe(2);
        // Still featured once newer titles pushed it out of the releases.
        expect(featuredTitle(releases, titles, 'movie:3')?.id).toBe(3);
        expect(featuredTitle(releases, titles, 'movie:404')?.id).toBe(1);
        // Still featured once it shows another of its versions.
        const merged = titled(7, NETFLIX, 4, {
            versions: [
                { id: 7, categoryId: '1610', language: 'ES', title: 'T7' },
                { id: 9, categoryId: '1125', language: 'EN', title: 'T9' },
            ],
        });
        expect(featuredTitle(releases, [merged, ...titles], 'movie:9')?.id).toBe(
            7
        );
        expect(featuredTitle(releases, titles, null)?.id).toBe(1);
        expect(featuredTitle([], [], null)).toBeNull();
    });

    it('features only a title the hero can show: one with a backdrop', () => {
        const titles = [
            titled(1, NETFLIX, 3),
            titled(2, HBO, 2, { backdrop: 'http://img/b2.jpg' }),
            titled(3, PRIME, 1, { backdrop: 'http://img/b3.jpg' }),
        ];
        const withBackdrop = (title: CatalogTitle) => !!title.backdrop;

        // The first release has none: the next one with a backdrop.
        expect(featuredTitle(titles, titles, null, withBackdrop)?.id).toBe(2);
        expect(featuredTitle(titles, titles, 'movie:3', withBackdrop)?.id).toBe(
            3
        );
        // A pick without one is not featured either.
        expect(featuredTitle(titles, titles, 'movie:1', withBackdrop)?.id).toBe(
            2
        );
        // None has one: no title, rather than a poster.
        expect(
            featuredTitle(titles.slice(0, 1), titles, null, withBackdrop)
        ).toBeNull();
    });
});
