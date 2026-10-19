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
            open: jest.fn(),
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: StoredVodCatalog, useValue: stored },
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

    it("loads the platforms' own lists one after the other when nothing is stored", async () => {
        stored.read.mockResolvedValue(null);
        const order: string[] = [];
        const load = platforms.loadTitles.getMockImplementation() as (
            id: StreamingPlatformId
        ) => Promise<void>;
        platforms.loadTitles.mockImplementation(async (id) => {
            order.push(`start ${id}`);
            await load(id);
            order.push(`end ${id}`);
        });

        await service.load('series');

        expect(order).toEqual([
            'start netflix',
            'end netflix',
            'start disney-plus',
            'end disney-plus',
        ]);
        expect(
            service
                .titles('series')
                ?.map((title) => [title.title, title.platform.id])
        ).toEqual([
            ['Show of netflix', 'netflix'],
            ['Show of disney-plus', 'disney-plus'],
        ]);
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

    it('waits for a source', async () => {
        platforms.source.set(null);

        await service.load('series');

        expect(stored.read).not.toHaveBeenCalled();
        expect(service.status('series')).toBe('no-source');
    });
});
