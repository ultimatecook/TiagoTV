import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import {
    toPlatformTitles,
    type PlatformTitle,
} from '../platforms/platform-titles';
import {
    buildPlatformShelves,
    type PlatformShelf,
    type StreamingPlatformId,
} from '../platforms/streaming-platforms';
import { CatalogImport } from './catalog-import';
import { StoredVodCatalog } from './catalog-stored';
import { toStoredVodCatalog } from './catalog-stored-rows';
import { CatalogService } from './catalog.service';

const SOURCE = {
    _id: 'p1',
    serverUrl: 'http://provider.example',
    username: 'user',
    password: 'secret',
};

const SHELVES = buildPlatformShelves(
    [{ category_id: '1610', category_name: '|ES| ✪ ORIGINAL NETFLIX' }],
    [
        { category_id: '2331', category_name: '|ES| ✪ NETFLIX SERIES' },
        { category_id: '1720', category_name: '|ES| ✪ DISNEY+' },
    ]
);

describe('CatalogService', () => {
    let stored: { read: jest.Mock; version: ReturnType<typeof signal> };
    let api: { getVodInfo: jest.Mock; getSeriesInfo: jest.Mock };
    let platforms: {
        source: ReturnType<typeof signal>;
        shelves: ReturnType<typeof signal<PlatformShelf[] | null>>;
        failed: ReturnType<typeof signal<boolean>>;
        loaded: Map<StreamingPlatformId, PlatformTitle[]>;
        titlesOf: jest.Mock;
        loadShelves: jest.Mock;
        loadTitles: jest.Mock;
        categoryTitles: jest.Mock;
        open: jest.Mock;
    };
    let service: CatalogService;

    beforeEach(() => {
        stored = { read: jest.fn(), version: signal(0) };
        api = {
            getVodInfo: jest.fn().mockResolvedValue({
                info: { duration: '01:40:00', backdrop_path: ['https://bd'] },
            }),
            getSeriesInfo: jest.fn(),
        };
        const loaded = new Map<StreamingPlatformId, PlatformTitle[]>();
        const version = signal(0);
        platforms = {
            source: signal(SOURCE),
            shelves: signal<PlatformShelf[] | null>(null),
            failed: signal(false),
            loaded,
            titlesOf: jest.fn((id: StreamingPlatformId) => {
                version();
                return loaded.get(id) ?? null;
            }),
            loadShelves: jest.fn(async () => platforms.shelves.set(SHELVES)),
            loadTitles: jest.fn(async (id: StreamingPlatformId) => {
                loaded.set(
                    id,
                    toPlatformTitles(
                        {
                            id: id === 'netflix' ? '2331' : '1720',
                            kind: 'series',
                            language: 'ES',
                        },
                        [{ series_id: id.length, name: `Show of ${id}` }]
                    )
                );
                version.update((value) => value + 1);
            }),
            categoryTitles: jest.fn(async (category) =>
                toPlatformTitles(category, [
                    {
                        series_id: Number(category.id),
                        name: `Show of ${category.id}`,
                    },
                ])
            ),
            open: jest.fn(),
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: StoredVodCatalog, useValue: stored },
                // The browser build: nothing is imported (see the first-run spec).
                {
                    provide: CatalogImport,
                    useValue: { supported: false, ensure: jest.fn() },
                },
                { provide: XtreamApiService, useValue: api },
                { provide: PlatformsCatalogService, useValue: platforms },
            ],
        });
        service = TestBed.inject(CatalogService);
    });

    it('reads the stored catalog and asks the provider nothing', async () => {
        stored.read.mockResolvedValue(
            toStoredVodCatalog(
                [
                    {
                        category_id: '1610',
                        category_name: '|ES| ✪ ORIGINAL NETFLIX',
                    },
                ],
                [{ stream_id: 7, name: 'EL HOYO', category_id: '1610' }],
                false
            )
        );

        expect(service.status('movie')).toBe('loading');
        await service.load('movie');

        expect(stored.read).toHaveBeenCalledWith(
            'p1',
            {
                serverUrl: SOURCE.serverUrl,
                username: SOURCE.username,
                password: SOURCE.password,
            },
            'movie'
        );
        expect(service.titles('movie')?.map((title) => title.title)).toEqual([
            'EL HOYO',
        ]);
        expect(service.status('movie')).toBe('ready');
        expect(platforms.loadShelves).not.toHaveBeenCalled();
        expect(platforms.loadTitles).not.toHaveBeenCalled();

        // Fresh: a second visit reads nothing again.
        await service.load('movie');
        expect(stored.read).toHaveBeenCalledTimes(1);
    });

    it("asks the platforms' categories one at a time when nothing is stored", async () => {
        stored.read.mockResolvedValue(null);
        let running = 0;
        let most = 0;
        const answer = platforms.categoryTitles.getMockImplementation() as (
            category: unknown
        ) => Promise<PlatformTitle[]>;
        platforms.categoryTitles.mockImplementation(async (category) => {
            most = Math.max(most, ++running);
            const titles = await answer(category);
            running--;
            return titles;
        });

        await service.load('series');

        expect(
            platforms.categoryTitles.mock.calls.map(([category]) => category.id)
        ).toEqual(['2331', '1720']);
        expect(most).toBe(1);
        // A platform's page loads its own lists: none were asked here.
        expect(platforms.loadTitles).not.toHaveBeenCalled();
        expect(
            service
                .titles('series')
                ?.map((title) => [title.title, title.platform.id])
        ).toEqual([
            ['Show of 2331', 'netflix'],
            ['Show of 1720', 'disney-plus'],
        ]);
    });

    it("reuses the lists a platform's page already loaded", async () => {
        stored.read.mockResolvedValue(null);
        await platforms.loadTitles('netflix');

        await service.load('series');

        expect(
            platforms.categoryTitles.mock.calls.map(([category]) => category.id)
        ).toEqual(['1720']);
        expect(
            service.titles('series')?.map((title) => title.platform.id)
        ).toEqual(['netflix', 'disney-plus']);
    });

    it('fails only once nothing loaded and the platforms failed', async () => {
        stored.read.mockRejectedValue(new Error('worker gone'));
        platforms.loadShelves.mockImplementation(async () =>
            platforms.failed.set(true)
        );

        await service.load('movie');

        expect(service.titles('movie')).toBeNull();
        expect(service.status('movie')).toBe('failed');
    });

    it("fetches a hero title's page once", async () => {
        stored.read.mockResolvedValue(
            toStoredVodCatalog(
                [
                    {
                        category_id: '1610',
                        category_name: '|ES| ✪ ORIGINAL NETFLIX',
                    },
                ],
                [{ stream_id: 7, name: 'EL HOYO', category_id: '1610' }],
                false
            )
        );
        await service.load('movie');
        const [title] = service.titles('movie') ?? [];

        service.loadExtras(title);
        service.loadExtras(title);
        await Promise.resolve();
        await Promise.resolve();

        expect(api.getVodInfo).toHaveBeenCalledTimes(1);
        expect(service.extrasOf(title)).toMatchObject({
            backdrop: 'https://bd',
            minutes: 100,
        });

        service.open(title);
        expect(platforms.open).toHaveBeenCalledWith(title);
    });

    it("draws the hero's leading platform once a session", () => {
        const lead = service.heroLead();

        expect(Number.isInteger(lead)).toBe(true);
        expect(service.heroLead()).toBe(lead);
    });

    it('waits for a source', async () => {
        platforms.source.set(null);

        await service.load('series');

        expect(stored.read).not.toHaveBeenCalled();
        expect(service.status('series')).toBe('no-source');
    });
});
