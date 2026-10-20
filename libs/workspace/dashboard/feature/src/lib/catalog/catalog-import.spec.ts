import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import {
    DatabaseService,
    ParentalLockService,
    RuntimeCapabilitiesService,
    SourceActivityService,
    XtreamPendingRestoreService,
} from '@iptvnator/services';
import {
    CATALOG_IMPORT_POLL_MS,
    CATALOG_IMPORT_RETRY_MS,
    CatalogImport,
} from './catalog-import';

const CREDENTIALS = {
    serverUrl: 'http://provider.example',
    username: 'user',
    password: 'secret',
};

/**
 * Electron's import of one kind, as the Xtream store runs it: categories,
 * then the whole list, saved by the DB worker, then the status.
 */
describe('CatalogImport', () => {
    let statuses: Map<string, string>;
    let contents: Set<string>;
    let log: string[];
    let database: {
        getXtreamImportStatus: jest.Mock;
        setXtreamImportStatus: jest.Mock;
        clearXtreamImportCache: jest.Mock;
    };
    let dataSource: {
        getCategories: jest.Mock;
        getContent: jest.Mock;
        hasContent: jest.Mock;
    };
    let pending: { getOrThrow: jest.Mock };
    let activity: SourceActivityService;

    function setup(sqlite = true): CatalogImport {
        statuses = new Map();
        contents = new Set();
        log = [];
        database = {
            getXtreamImportStatus: jest.fn(
                async (playlistId: string, kind: string) =>
                    statuses.get(`${playlistId}:${kind}`) ?? 'idle'
            ),
            setXtreamImportStatus: jest.fn(
                async (playlistId: string, kind: string, status: string) => {
                    log.push(`status ${kind} ${status}`);
                    statuses.set(`${playlistId}:${kind}`, status);
                    return true;
                }
            ),
            clearXtreamImportCache: jest.fn(async (_id, kind: string) => {
                log.push(`clear ${kind}`);
                return true;
            }),
        };
        dataSource = {
            getCategories: jest.fn(async (_id, _credentials, type: string) => {
                log.push(`categories ${type}`);
                return [];
            }),
            getContent: jest.fn(
                async (playlistId: string, _credentials, kind: string) => {
                    log.push(`content ${kind}`);
                    contents.add(`${playlistId}:${kind}`);
                    return [];
                }
            ),
            hasContent: jest.fn(async (playlistId: string, kind: string) =>
                contents.has(`${playlistId}:${kind}`)
            ),
        };
        pending = { getOrThrow: jest.fn(() => null) };
        TestBed.configureTestingModule({
            providers: [
                { provide: DatabaseService, useValue: database },
                { provide: XTREAM_DATA_SOURCE, useValue: dataSource },
                { provide: XtreamPendingRestoreService, useValue: pending },
                {
                    provide: ParentalLockService,
                    useValue: { withholdsEverything: signal(false) },
                },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsXtreamSqliteDataSource: sqlite },
                },
            ],
        });
        activity = TestBed.inject(SourceActivityService);
        return TestBed.inject(CatalogImport);
    }

    afterEach(() => jest.useRealTimers());

    it("imports a fresh install's kind once, as the Xtream store would", async () => {
        const importer = setup();

        // The page and the Home's section ask at the same time.
        const [page, home] = await Promise.all([
            importer.ensure('p1', CREDENTIALS, 'series'),
            importer.ensure('p1', CREDENTIALS, 'series'),
        ]);

        expect([page, home]).toEqual([true, true]);
        expect(log).toEqual([
            'categories series',
            'content series',
            'status series completed',
        ]);
        expect(dataSource.getContent).toHaveBeenCalledWith(
            'p1',
            CREDENTIALS,
            'series'
        );
        // Free again for a refresh or a removal.
        expect(activity.isBusy('p1')).toBe(false);
    });

    it('holds the source busy while it imports', async () => {
        const importer = setup();
        let busy = false;
        dataSource.getContent.mockImplementation(async () => {
            busy = activity.isBusy('p1');
            contents.add('p1:movie');
            return [];
        });

        await importer.ensure('p1', CREDENTIALS, 'movie');

        expect(busy).toBe(true);
        expect(activity.isBusy('p1')).toBe(false);
    });

    it('imports nothing once the kind was imported', async () => {
        const importer = setup();
        statuses.set('p1:movie', 'completed');

        await expect(importer.ensure('p1', CREDENTIALS, 'movie')).resolves.toBe(
            true
        );
        expect(dataSource.getContent).not.toHaveBeenCalled();
    });

    it('imports one kind at a time', async () => {
        const importer = setup();

        await Promise.all([
            importer.ensure('p1', CREDENTIALS, 'movie'),
            importer.ensure('p1', CREDENTIALS, 'series'),
        ]);

        expect(log).toEqual([
            'categories vod',
            'content movie',
            'status movie completed',
            'categories series',
            'content series',
            'status series completed',
        ]);
    });

    it('waits for an import already running and reads what it stored', async () => {
        jest.useFakeTimers();
        const importer = setup();
        // The Xtream store's own import of the source (or a refresh).
        const release = activity.begin(['p1']);

        let answer: boolean | undefined;
        void importer
            .ensure('p1', CREDENTIALS, 'series')
            .then((value) => (answer = value));
        await jest.advanceTimersByTimeAsync(CATALOG_IMPORT_POLL_MS * 5);
        expect(answer).toBeUndefined();
        expect(database.getXtreamImportStatus).not.toHaveBeenCalled();

        statuses.set('p1:series', 'completed');
        release();
        await jest.advanceTimersByTimeAsync(CATALOG_IMPORT_POLL_MS);

        expect(answer).toBe(true);
        expect(dataSource.getCategories).not.toHaveBeenCalled();
        expect(dataSource.getContent).not.toHaveBeenCalled();
    });

    it('tries a refused import once more, then records it failed', async () => {
        jest.useFakeTimers();
        const importer = setup();
        dataSource.getContent.mockRejectedValue(new Error('refused'));

        let answer: boolean | undefined;
        void importer
            .ensure('p1', CREDENTIALS, 'movie')
            .then((value) => (answer = value));
        await jest.advanceTimersByTimeAsync(0);
        expect(dataSource.getContent).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(CATALOG_IMPORT_RETRY_MS);

        expect(answer).toBe(false);
        expect(dataSource.getContent).toHaveBeenCalledTimes(2);
        expect(log.slice(-2)).toEqual(['status movie failed', 'clear movie']);

        // Not again this session: the platforms' lists serve the page.
        await expect(importer.ensure('p1', CREDENTIALS, 'movie')).resolves.toBe(
            false
        );
        expect(dataSource.getContent).toHaveBeenCalledTimes(2);
    });

    it('records an empty answer as failed, not as an imported catalog', async () => {
        const importer = setup();
        dataSource.getContent.mockResolvedValue([]);

        await expect(importer.ensure('p1', CREDENTIALS, 'series')).resolves.toBe(
            false
        );
        expect(database.setXtreamImportStatus).toHaveBeenCalledWith(
            'p1',
            'series',
            'failed'
        );
    });

    it('leaves a cancelled import cancelled', async () => {
        const importer = setup();
        statuses.set('p1:movie', 'cancelled');

        await expect(importer.ensure('p1', CREDENTIALS, 'movie')).resolves.toBe(
            false
        );
        expect(dataSource.getContent).not.toHaveBeenCalled();
    });

    it("leaves a pending backup restore to the Xtream store's flow", async () => {
        const importer = setup();
        pending.getOrThrow.mockReturnValue({ favorites: [] });

        await expect(importer.ensure('p1', CREDENTIALS, 'movie')).resolves.toBe(
            false
        );

        pending.getOrThrow.mockImplementation(() => {
            throw new Error('storage blocked');
        });
        await expect(importer.ensure('p1', CREDENTIALS, 'series')).resolves.toBe(
            false
        );
        expect(dataSource.getContent).not.toHaveBeenCalled();
    });

    it('imports nothing in the browser build', async () => {
        const importer = setup(false);

        await expect(importer.ensure('p1', CREDENTIALS, 'movie')).resolves.toBe(
            false
        );
        expect(database.getXtreamImportStatus).not.toHaveBeenCalled();
        expect(dataSource.getContent).not.toHaveBeenCalled();
    });
});
