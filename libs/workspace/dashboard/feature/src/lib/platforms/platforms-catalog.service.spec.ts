import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import { PlatformsCatalogService } from './platforms-catalog.service';
import { toPlatformTitles } from './platform-titles';
import { mergePlatformTitles } from './platform-versions';

describe('PlatformsCatalogService', () => {
    const navigate = jest.fn<Promise<boolean>, [unknown[], unknown?]>(() =>
        Promise.resolve(true)
    );
    const api: {
        getCategories?: jest.Mock;
        getSeriesStreams?: jest.Mock;
    } = {};
    // "MUERTOS S.L." and "DEATH INC.": one show, a card in Spanish.
    const [muertos] = mergePlatformTitles([
        toPlatformTitles({ id: '482', kind: 'series', language: 'EN' }, [
            { series_id: 13, name: 'DEATH INC. (2024)_ENG', cover: 'p' },
        ]),
        toPlatformTitles({ id: '2331', kind: 'series', language: 'ES' }, [
            { series_id: 2, name: 'MUERTOS S.L. (2024) ES', cover: 'p' },
        ]),
    ]);

    beforeEach(() => {
        navigate.mockClear();
        localStorage.clear();
        delete api.getCategories;
        delete api.getSeriesStreams;
        TestBed.configureTestingModule({
            providers: [
                provideMockStore({
                    selectors: [
                        {
                            selector: selectAllPlaylistsMeta,
                            value: [
                                {
                                    _id: 'source',
                                    serverUrl: 'http://provider.test',
                                    username: 'user',
                                    password: 'secret',
                                },
                            ],
                        },
                    ],
                }),
                { provide: XtreamApiService, useValue: api },
                { provide: Router, useValue: { navigate } },
            ],
        });
    });

    it("opens a title's Spanish version, or the version picked", () => {
        const catalog = TestBed.inject(PlatformsCatalogService);

        catalog.open(muertos);
        catalog.open(muertos, muertos.versions[1]);

        expect(navigate.mock.calls.map(([link]) => link)).toEqual([
            ['/workspace', 'xtreams', 'source', 'series', '2331', '2'],
            ['/workspace', 'xtreams', 'source', 'series', '482', '13'],
        ]);
    });

    it('opens a title playing it: its page carries the play request', () => {
        const catalog = TestBed.inject(PlatformsCatalogService);

        catalog.play(muertos, 'first-episode');

        expect(navigate).toHaveBeenCalledWith(
            ['/workspace', 'xtreams', 'source', 'series', '2331', '2'],
            {
                state: {
                    detailPlayRequest: { mode: 'first-episode', contentId: 2 },
                },
            }
        );
    });

    const netflixVod = [
        { category_id: 7, category_name: '|ES| ✪ ORIGINAL NETFLIX' },
    ];
    const platformIds = (catalog: PlatformsCatalogService) =>
        (catalog.shelves() ?? []).map((shelf) => shelf.platform.id);

    it('keeps the last platforms that loaded when the provider is busy', async () => {
        api.getCategories = jest.fn((_credentials, kind: string) =>
            Promise.resolve(kind === 'vod' ? netflixVod : [])
        );
        await TestBed.inject(PlatformsCatalogService).loadShelves();

        // The next launch: the provider refuses while the app imports.
        TestBed.resetTestingModule();
        api.getCategories = jest.fn(() => Promise.reject(new Error('busy')));
        TestBed.configureTestingModule({
            providers: [
                provideMockStore({
                    selectors: [
                        {
                            selector: selectAllPlaylistsMeta,
                            value: [
                                {
                                    _id: 'source',
                                    serverUrl: 'http://provider.test',
                                    username: 'user',
                                    password: 'secret',
                                },
                            ],
                        },
                    ],
                }),
                { provide: XtreamApiService, useValue: api },
                { provide: Router, useValue: { navigate } },
            ],
        });
        const catalog = TestBed.inject(PlatformsCatalogService);
        await catalog.loadShelves();

        expect(catalog.failed()).toBe(true);
        expect(platformIds(catalog)).toEqual(['netflix']);
    });

    it("asks for one category's list, with the source's genres", async () => {
        api.getCategories = jest.fn((_credentials, kind: string) =>
            Promise.resolve(
                kind === 'series'
                    ? [
                          {
                              category_id: 2331,
                              category_name: '|ES| ✪ NETFLIX SERIES',
                          },
                          { category_id: 91, category_name: '|ES| ✪ COMEDIA' },
                      ]
                    : []
            )
        );
        api.getSeriesStreams = jest.fn(() =>
            Promise.resolve([
                {
                    series_id: 5,
                    name: 'MUERTOS S.L. (2024) ES',
                    category_ids: [2331, 91],
                },
            ])
        );
        const catalog = TestBed.inject(PlatformsCatalogService);
        await catalog.loadShelves();

        const titles = await catalog.categoryTitles({
            id: '2331',
            kind: 'series',
            language: 'ES',
        });

        expect(api.getSeriesStreams).toHaveBeenCalledTimes(1);
        expect(api.getSeriesStreams).toHaveBeenCalledWith(
            {
                serverUrl: 'http://provider.test',
                username: 'user',
                password: 'secret',
            },
            { suppressErrorLog: true, categoryId: '2331' }
        );
        expect(titles.map((title) => [title.title, title.genres])).toEqual([
            ['MUERTOS S.L.', ['comedy']],
        ]);
        // Diagnóstico names it as the provider does.
        expect(
            catalog.categoryName({ id: '2331', kind: 'series', language: 'ES' })
        ).toBe('|ES| ✪ NETFLIX SERIES');
        expect(
            catalog.categoryName({ id: '2331', kind: 'movie', language: 'ES' })
        ).toBeNull();
    });

    it('asks for the movie and series categories one after the other', async () => {
        let running = 0;
        let most = 0;
        api.getCategories = jest.fn(async (_credentials, kind: string) => {
            most = Math.max(most, ++running);
            await Promise.resolve();
            running--;
            return kind === 'vod' ? netflixVod : [];
        });

        await TestBed.inject(PlatformsCatalogService).loadShelves();

        expect(api.getCategories).toHaveBeenCalledTimes(2);
        expect(most).toBe(1);
    });

    it('tries a failed load again shortly', async () => {
        jest.useFakeTimers();
        try {
            api.getCategories = jest
                .fn()
                .mockRejectedValueOnce(new Error('busy'))
                .mockImplementation((_credentials, kind: string) =>
                    Promise.resolve(kind === 'vod' ? netflixVod : [])
                );
            const catalog = TestBed.inject(PlatformsCatalogService);
            await catalog.loadShelves();
            expect(platformIds(catalog)).toEqual([]);

            await jest.advanceTimersByTimeAsync(20_000);

            expect(platformIds(catalog)).toEqual(['netflix']);
            expect(catalog.failed()).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });
});
