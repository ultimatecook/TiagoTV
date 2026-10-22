import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { selectAllPlaylistsMeta } from '@iptvnator/m3u-state';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import { CatalogMembership } from '../catalog/catalog-membership';
import { CatalogPlatformLists } from '../catalog/catalog-platform-lists';
import type { PlatformTitleList } from '../catalog/catalog-titles';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { toPlatformTitles } from '../platforms/platform-titles';
import {
    findStreamingPlatform,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import { listTitleHits, mergeTitleHits } from './search-list-hits';
import { foldTerm, type TitleHit } from './search-results';
import { SearchTitlesService } from './search-titles.service';

const PRIME = findStreamingPlatform('prime-video') as StreamingPlatform;
const HBO = findStreamingPlatform('hbo-max') as StreamingPlatform;
const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;

/** The platforms' lists: titles the stored catalog lacks. */
const LISTS: PlatformTitleList[] = [
    {
        platform: PRIME,
        titles: toPlatformTitles(
            { id: '1270', kind: 'series', language: 'EN' },
            [
                { series_id: 5, name: 'The Boys (2019)', cover: 'http://b' },
                { series_id: 8, name: 'Reacher (2022)' },
            ]
        ),
    },
    {
        platform: HBO,
        titles: toPlatformTitles(
            { id: '2330', kind: 'series', language: 'ES' },
            [{ series_id: 9, name: 'The Last of Us (2023)' }]
        ),
    },
    {
        platform: NETFLIX,
        titles: toPlatformTitles(
            { id: '2331', kind: 'series', language: 'ES' },
            [{ series_id: 6, name: 'DARK (2017)' }]
        ),
    },
];

describe('listTitleHits', () => {
    it("finds the platforms' titles by every word, named with their platform", () => {
        expect(
            listTitleHits(LISTS, 'series', foldTerm('the boys')).map((hit) => [
                hit.title,
                hit.platform,
                hit.year,
                hit.xtreamId,
                hit.categoryId,
            ])
        ).toEqual([['The Boys', 'Prime Video', 2019, 5, '1270']]);
        expect(
            listTitleHits(LISTS, 'series', foldTerm('last us')).map(
                (hit) => hit.title
            )
        ).toEqual(['The Last of Us']);
        expect(listTitleHits(LISTS, 'movie', foldTerm('reacher'))).toEqual([]);
    });

    it("names a stored answer's platform from the lists, once per title", () => {
        const stored: TitleHit = {
            key: 'series:the boys',
            kind: 'series',
            title: 'The Boys',
            year: 2019,
            platform: null,
            poster: null,
            categoryId: '77',
            xtreamId: 5,
            rank: 0,
        };
        const listed = listTitleHits(LISTS, 'series', foldTerm('the'));

        const merged = mergeTitleHits([stored], listed);

        expect(merged.map((hit) => [hit.title, hit.platform])).toEqual([
            ['The Boys', 'Prime Video'],
            ['The Last of Us', 'HBO Max'],
        ]);
        expect(merged[0]).toMatchObject({
            categoryId: '77',
            poster: 'http://b',
        });
    });
});

describe('SearchTitlesService', () => {
    function setup(stored: boolean) {
        const dataSource = {
            hasContent: jest.fn(async () => stored),
            // The stored catalog holds Netflix's titles alone.
            searchContent: jest.fn(async () => [
                { category_id: 601, title: 'DARK (2017)', xtream_id: 6 },
            ]),
            getCachedCategories: jest.fn(async () => [
                { id: 601, name: '|ES| ✪ NETFLIX SERIES', xtream_id: 2331 },
            ]),
        };
        TestBed.configureTestingModule({
            providers: [
                SearchTitlesService,
                provideMockStore({
                    selectors: [
                        {
                            selector: selectAllPlaylistsMeta,
                            value: [
                                {
                                    _id: 'p1',
                                    serverUrl: 'http://provider.example',
                                    username: 'user',
                                    password: 'secret',
                                },
                            ],
                        },
                    ],
                }),
                { provide: XTREAM_DATA_SOURCE, useValue: dataSource },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsXtreamSqliteDataSource: true },
                },
                {
                    provide: CatalogMembership,
                    useValue: {
                        refresh: jest.fn(async () => undefined),
                        platformOf: () => null,
                    },
                },
                {
                    provide: CatalogPlatformLists,
                    useValue: {
                        ready: async () => undefined,
                        view: () => ({
                            lists: LISTS,
                            total: 3,
                            answered: 3,
                            failed: 0,
                        }),
                    },
                },
                {
                    provide: PlatformsCatalogService,
                    useValue: { loadShelves: jest.fn(async () => undefined) },
                },
            ],
        });
        return TestBed.inject(SearchTitlesService);
    }

    it('finds a title only the platforms list, labelled with its platform', async () => {
        const search = setup(true);

        const { series } = await search.search('the boys', 'the boys');

        expect(series?.map((hit) => [hit.title, hit.platform])).toEqual([
            ['The Boys', 'Prime Video'],
        ]);
    });

    it("searches the platforms' lists where nothing is stored", async () => {
        const search = setup(false);

        const { series, movies } = await search.search('reacher', 'reacher');

        expect(series?.map((hit) => hit.title)).toEqual(['Reacher']);
        expect(movies).toEqual([]);
    });
});
