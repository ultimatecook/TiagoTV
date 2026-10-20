import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    XTREAM_DATA_SOURCE,
    XtreamApiService,
} from '@iptvnator/portal/xtream/data-access';
import {
    DatabaseService,
    ParentalLockService,
    RuntimeCapabilitiesService,
    SourceActivityService,
    XtreamPendingRestoreService,
} from '@iptvnator/services';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { toPlatformTitles } from '../platforms/platform-titles';
import {
    buildPlatformShelves,
    type PlatformCategory,
    type PlatformShelf,
} from '../platforms/streaming-platforms';
import {
    CATALOG_IMPORT_POLL_MS,
    CATALOG_IMPORT_RETRY_MS,
} from './catalog-import';
import type { StoredVodRow } from './catalog-stored-rows';
import type { CatalogTitle } from './catalog-titles';
import { CatalogService } from './catalog.service';

/**
 * Series on a fresh install of the macOS app ("siguen mostrando solo
 * Netflix"): nothing is stored, and the redesign opens no Xtream view
 * that would import the catalog. Netflix is the biggest platform and the
 * first one the provider lists.
 */
const SOURCE = {
    _id: 'p1',
    serverUrl: 'http://provider.example',
    username: 'user',
    password: 'secret',
};
const T0 = 1_760_000_000;

/** provider id, DB row id, name, shows. */
const PLATFORMS: readonly [number, number, string, number][] = [
    [2331, 601, '|ES| ✪ NETFLIX SERIES', 6],
    [1270, 604, '|EN| ✪ AMAZON-PRIME', 3],
    [2330, 603, '|ES| ✪ HBO-MAX', 3],
    [1720, 605, '|ES| ✪ DISNEY+', 2],
    [1284, 606, '|EN| ✪ APPLE TV+', 2],
    [482, 602, '|EN| ✪ NETFLIX', 4],
];
const SERIES_CATEGORIES = PLATFORMS.map(([id, , name]) => ({
    category_id: String(id),
    category_name: name,
}));
const SHELVES = buildPlatformShelves([], SERIES_CATEGORIES);
const DB_CATEGORIES = PLATFORMS.map(([xtreamId, id, name]) => ({
    id,
    name,
    playlist_id: 'p1',
    type: 'series' as const,
    xtream_id: xtreamId,
    hidden: false,
    locked: false,
}));
/** Netflix's shows are the newest of all. */
const showsOf = ([providerId, , , count]: (typeof PLATFORMS)[number]) =>
    Array.from({ length: count }, (_, index) => ({
        series_id: providerId * 100 + index,
        name: `SHOW ${providerId}-${index}`,
        cover: `http://img/${providerId}-${index}.jpg`,
        last_modified: String(T0 - (providerId === 2331 ? index : 500 + index)),
    }));
const DB_ROWS: StoredVodRow[] = PLATFORMS.reduce<StoredVodRow[]>(
    (rows, platform) =>
        rows.concat(
            showsOf(platform).map((show) => ({
                xtream_id: show.series_id,
                title: show.name,
                poster_url: show.cover,
                added: show.last_modified,
                category_id: platform[1],
            }))
        ),
    []
);

const platformsIn = (titles: readonly CatalogTitle[] | null) =>
    new Set((titles ?? []).map((title) => title.platform.id));

describe('Series and Películas on a first run', () => {
    let saved: { categories: boolean; content: boolean };
    let statuses: Map<string, string>;
    let dataSource: {
        getCategories: jest.Mock;
        getContent: jest.Mock;
        hasContent: jest.Mock;
        getCachedCategories: jest.Mock;
        getCachedContent: jest.Mock;
    };
    let platforms: {
        source: ReturnType<typeof signal>;
        shelves: ReturnType<typeof signal<PlatformShelf[] | null>>;
        failed: ReturnType<typeof signal<boolean>>;
        titlesOf: jest.Mock;
        loadShelves: jest.Mock;
        categoryTitles: jest.Mock;
        open: jest.Mock;
        play: jest.Mock;
    };
    let asked: string[];
    let activity: SourceActivityService;
    let service: CatalogService;

    function setup(sqlite: boolean): void {
        saved = { categories: false, content: false };
        statuses = new Map();
        asked = [];
        dataSource = {
            getCategories: jest.fn(async () => {
                saved.categories = true;
                return [];
            }),
            getContent: jest.fn(async () => {
                saved.content = true;
                return [];
            }),
            hasContent: jest.fn(async () => saved.content),
            getCachedCategories: jest.fn(async () =>
                saved.categories ? DB_CATEGORIES : []
            ),
            getCachedContent: jest.fn(async () =>
                saved.content ? DB_ROWS : []
            ),
        };
        platforms = {
            source: signal(SOURCE),
            shelves: signal<PlatformShelf[] | null>(null),
            failed: signal(false),
            titlesOf: jest.fn(() => null),
            loadShelves: jest.fn(async () => platforms.shelves.set(SHELVES)),
            categoryTitles: jest.fn(async (category: PlatformCategory) => {
                asked.push(category.id);
                const platform = PLATFORMS.find(
                    ([id]) => String(id) === category.id
                );
                return toPlatformTitles(
                    category,
                    platform ? showsOf(platform) : []
                );
            }),
            open: jest.fn(),
            play: jest.fn(),
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: PlatformsCatalogService, useValue: platforms },
                { provide: XTREAM_DATA_SOURCE, useValue: dataSource },
                { provide: XtreamApiService, useValue: {} },
                {
                    provide: DatabaseService,
                    useValue: {
                        getXtreamImportStatus: jest.fn(
                            async (_id: string, kind: string) =>
                                statuses.get(kind) ?? 'idle'
                        ),
                        setXtreamImportStatus: jest.fn(
                            async (_id: string, kind: string, value: string) =>
                                statuses.set(kind, value)
                        ),
                        clearXtreamImportCache: jest.fn(async () => true),
                    },
                },
                {
                    provide: XtreamPendingRestoreService,
                    useValue: { getOrThrow: () => null },
                },
                {
                    provide: ParentalLockService,
                    useValue: {
                        version: signal(0),
                        withholdsEverything: signal(false),
                    },
                },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsXtreamSqliteDataSource: sqlite },
                },
            ],
        });
        activity = TestBed.inject(SourceActivityService);
        service = TestBed.inject(CatalogService);
    }

    afterEach(() => jest.useRealTimers());

    it("imports the kind once in Electron and shows every platform's titles", async () => {
        setup(true);
        let finish: () => void = () => undefined;
        dataSource.getContent.mockImplementation(
            () =>
                new Promise<[]>((resolve) => {
                    finish = () => {
                        saved.content = true;
                        resolve([]);
                    };
                })
        );

        // The page and the Home's "Series para vos" ask at once.
        const page = service.load('series');
        const home = service.load('series');
        await new Promise((resolve) => setTimeout(resolve));

        expect(service.status('series')).toBe('loading');
        expect(service.preparing('series')).toBe(true);
        expect(service.titles('series')).toBeNull();
        // The Home's hero reads the stored copy alone: it does not wait.
        await expect(service.loadStored('series')).resolves.toBeUndefined();
        expect(service.titles('series')).toBeNull();
        // Two requests for the whole catalog, none per platform category:
        // the platforms' lists (see CatalogMembership) wait for it.
        expect(platforms.categoryTitles).not.toHaveBeenCalled();
        expect(platforms.loadShelves).not.toHaveBeenCalled();

        finish();
        await Promise.all([page, home]);

        expect(dataSource.getCategories).toHaveBeenCalledTimes(1);
        expect(dataSource.getContent).toHaveBeenCalledTimes(1);
        expect(dataSource.getContent).toHaveBeenCalledWith(
            'p1',
            {
                serverUrl: SOURCE.serverUrl,
                username: SOURCE.username,
                password: SOURCE.password,
            },
            'series'
        );
        expect(statuses.get('series')).toBe('completed');

        const titles = service.titles('series');
        expect(service.status('series')).toBe('ready');
        expect(service.preparing('series')).toBe(false);
        expect(platformsIn(titles)).toEqual(
            new Set([
                'netflix',
                'prime-video',
                'hbo-max',
                'disney-plus',
                'apple-tv',
            ])
        );
        expect(platformsIn(titles?.slice(0, 5) ?? []).size).toBe(5);
    });

    it('waits for an import already running and reads what it stored', async () => {
        jest.useFakeTimers();
        setup(true);
        // The Xtream store imports the source (its Movies view was opened).
        const release = activity.begin(['p1']);

        const load = service.load('series');
        await jest.advanceTimersByTimeAsync(CATALOG_IMPORT_POLL_MS * 3);
        expect(service.preparing('series')).toBe(true);

        saved.categories = true;
        saved.content = true;
        statuses.set('series', 'completed');
        release();
        await jest.advanceTimersByTimeAsync(CATALOG_IMPORT_POLL_MS);
        await load;

        expect(dataSource.getContent).not.toHaveBeenCalled();
        expect(platformsIn(service.titles('series')).size).toBe(5);
    });

    it("falls back to the platforms' lists, in turns, once the import failed", async () => {
        jest.useFakeTimers();
        setup(true);
        dataSource.getContent.mockRejectedValue(new Error('refused'));

        const load = service.load('series');
        await jest.advanceTimersByTimeAsync(CATALOG_IMPORT_RETRY_MS);
        await load;

        expect(dataSource.getContent).toHaveBeenCalledTimes(2);
        expect(statuses.get('series')).toBe('failed');
        // Every platform's first category before Netflix's second.
        expect(asked).toEqual(['2331', '1270', '2330', '1720', '1284', '482']);
        expect(platformsIn(service.titles('series')).size).toBe(5);
    });

    it('shows nothing until three platforms answered (the browser build)', async () => {
        setup(false);
        const seen: (readonly CatalogTitle[] | null)[] = [];
        const answer = platforms.categoryTitles.getMockImplementation() as (
            category: PlatformCategory
        ) => Promise<unknown>;
        platforms.categoryTitles.mockImplementation((category) => {
            // What the page shows as each request leaves.
            seen.push(service.titles('series'));
            return answer(category);
        });

        await service.load('series');

        expect(dataSource.getContent).not.toHaveBeenCalled();
        expect(seen.slice(0, 3)).toEqual([null, null, null]);
        expect(platformsIn(seen[3])).toEqual(
            new Set(['netflix', 'prime-video', 'hbo-max'])
        );
        // Netflix is the newest, yet it leads only the first turn.
        expect(seen[3]?.slice(0, 3).map((title) => title.platform.id)).toEqual([
            'netflix',
            'prime-video',
            'hbo-max',
        ]);
        expect(platformsIn(service.titles('series')).size).toBe(5);
        expect(service.status('series')).toBe('ready');
    });

    it('fails only once every platform failed', async () => {
        jest.useFakeTimers();
        setup(false);
        platforms.categoryTitles.mockRejectedValue(new Error('refused'));

        const load = service.load('series');
        await jest.advanceTimersByTimeAsync(10_000);
        await load;

        expect(service.titles('series')).toBeNull();
        expect(service.status('series')).toBe('failed');
        // Each category once, then once more.
        expect(platforms.categoryTitles).toHaveBeenCalledTimes(12);
    });
});
