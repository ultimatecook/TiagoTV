import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    DatabaseService,
    RuntimeCapabilitiesService,
} from '@iptvnator/services';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import {
    toPlatformTitles,
    type PlatformTitle,
} from '../platforms/platform-titles';
import {
    buildPlatformShelves,
    findStreamingPlatform,
    type PlatformCategory,
    type StreamingPlatform,
} from '../platforms/streaming-platforms';
import { CatalogDiagnosticsService } from './catalog-diagnostics.service';
import { CatalogListAnswers } from './catalog-list-answers';
import { CatalogMembership } from './catalog-membership';
import { CatalogPlatformLists } from './catalog-platform-lists';
import { toStoredVodCatalog } from './catalog-stored-rows';
import type { CatalogTitle } from './catalog-titles';
import { CatalogService } from './catalog.service';

const NAMES: Record<string, string> = {
    '2331': '|ES| ✪ NETFLIX SERIES',
    '1270': '|EN| ✪ AMAZON-PRIME',
    '2330': '|ES| ✪ HBO-MAX',
};
const SHELVES = buildPlatformShelves(
    [],
    Object.entries(NAMES).map(([category_id, category_name]) => ({
        category_id,
        category_name,
    }))
);
const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;
const PRIME = findStreamingPlatform('prime-video') as StreamingPlatform;

describe('CatalogDiagnosticsService', () => {
    const lists: Record<string, PlatformTitle[]> = {
        '2331': toPlatformTitles(
            { id: '2331', kind: 'series', language: 'ES' },
            [{ series_id: 6, name: 'DARK' }]
        ),
        '1270': toPlatformTitles(
            { id: '1270', kind: 'series', language: 'EN' },
            [
                { series_id: 5, name: 'The Boys' },
                { series_id: 8, name: 'Reacher' },
            ]
        ),
    };
    const shown = (title: string, platform: StreamingPlatform) =>
        ({ title, platform }) as unknown as CatalogTitle;
    let catalog: Record<string, jest.Mock | ReturnType<typeof signal>>;
    let platformLists: Record<string, jest.Mock>;
    let membership: { clear: jest.Mock };

    beforeEach(() => {
        const stored = toStoredVodCatalog(
            Object.entries(NAMES).map(([category_id, category_name]) => ({
                category_id,
                category_name,
                parent_id: 0,
            })),
            [
                { series_id: 6, name: 'DARK', category_id: '2331' },
                // "The Boys" is stored, in a genre's category.
                { series_id: 5, name: 'The Boys', category_id: '99' },
            ],
            false
        );
        catalog = {
            source: signal({ _id: 'p1' }),
            storedData: jest.fn((kind) => (kind === 'series' ? stored : null)),
            titles: jest.fn((kind) =>
                kind === 'series'
                    ? [
                          shown('DARK', NETFLIX),
                          shown('The Boys', PRIME),
                          shown('Reacher', PRIME),
                      ]
                    : null
            ),
            loadStored: jest.fn(async () => undefined),
            reset: jest.fn(),
        };
        platformLists = {
            ready: jest.fn(async () => undefined),
            clear: jest.fn(async () => undefined),
            load: jest.fn(async () => undefined),
            categoryState: jest.fn((category: PlatformCategory) => ({
                titles: lists[category.id]?.length ?? null,
                at: lists[category.id] ? 1_760_000_000_000 : null,
                failure:
                    category.id === '2330'
                        ? { playlistId: 'p1', at: 1, outcome: 'failed' }
                        : null,
            })),
        };
        membership = { clear: jest.fn() };
        TestBed.configureTestingModule({
            providers: [
                { provide: CatalogService, useValue: catalog },
                { provide: CatalogPlatformLists, useValue: platformLists },
                {
                    provide: CatalogListAnswers,
                    useValue: {
                        lookup: computed(() => ({
                            titlesOf: (category: PlatformCategory) =>
                                lists[category.id],
                            failed: () => false,
                        })),
                    },
                },
                {
                    provide: PlatformsCatalogService,
                    useValue: {
                        shelves: signal(SHELVES),
                        categoryName: (category: PlatformCategory) =>
                            NAMES[category.id] ?? null,
                        loadShelves: jest.fn(async () => undefined),
                    },
                },
                { provide: CatalogMembership, useValue: membership },
                {
                    provide: DatabaseService,
                    useValue: {
                        getXtreamImportStatus: jest.fn(async () => 'completed'),
                    },
                },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsXtreamSqliteDataSource: true },
                },
            ],
        });
    });

    it('shows what Series is built from, per platform category', async () => {
        const diagnostics = TestBed.inject(CatalogDiagnosticsService);
        await diagnostics.read();

        const [series, movies] = diagnostics.kinds();

        expect(series).toMatchObject({
            kind: 'series',
            importStatus: 'completed',
            storedCategories: 3,
            storedRows: 2,
            answered: 2,
            total: 3,
            lastRefresh: 1_760_000_000_000,
            shown: [
                { platform: 'Prime Video', titles: 2 },
                { platform: 'Netflix', titles: 1 },
            ],
        });
        expect(
            series.categories.map((row) => [
                row.label,
                row.platform,
                row.stored,
                row.listed,
                row.listedStored,
                row.state,
            ])
        ).toEqual([
            ['ES · NETFLIX SERIES', 'Netflix', 1, 1, 1, 'ok'],
            ['EN · AMAZON-PRIME', 'Prime Video', 0, 2, 1, 'ok'],
            ['ES · HBO-MAX', 'HBO Max', 0, null, null, 'failed'],
        ]);
        expect(movies).toMatchObject({ storedRows: null, categories: [] });
    });

    it('forgets the caches and asks every list again on a reload', async () => {
        const diagnostics = TestBed.inject(CatalogDiagnosticsService);

        await diagnostics.reload();

        expect(platformLists['clear']).toHaveBeenCalled();
        expect(membership.clear).toHaveBeenCalled();
        expect(catalog['reset']).toHaveBeenCalled();
        expect(platformLists['load'].mock.calls).toEqual([
            ['series'],
            ['movie'],
        ]);
        expect(diagnostics.reloading()).toBe(false);
    });
});
