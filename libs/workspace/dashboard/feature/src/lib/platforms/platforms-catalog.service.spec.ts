import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import { PlatformsCatalogService } from './platforms-catalog.service';
import { toPlatformTitles } from './platform-titles';
import { mergePlatformTitles } from './platform-versions';

describe('PlatformsCatalogService', () => {
    const navigate = jest.fn(() => Promise.resolve(true));
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
                { provide: XtreamApiService, useValue: {} },
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
});
