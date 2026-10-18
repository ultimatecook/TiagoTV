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
} from '@iptvnator/services';
import { StoredLiveCatalog } from './stored-live-catalog';

const CREDENTIALS = {
    serverUrl: 'http://provider.example',
    username: 'user',
    password: 'secret',
};

describe('StoredLiveCatalog', () => {
    let dataSource: Record<string, jest.Mock>;
    let api: Record<string, jest.Mock>;
    let database: { getXtreamImportStatus: jest.Mock };

    function setup(sqlite: boolean): StoredLiveCatalog {
        dataSource = {
            hasCategories: jest.fn().mockResolvedValue(true),
            hasContent: jest.fn().mockResolvedValue(true),
            getCachedCategories: jest.fn().mockResolvedValue([
                {
                    id: 501,
                    name: '|ES| ✪ DEPORTES',
                    playlist_id: 'p1',
                    type: 'live',
                    xtream_id: 13,
                    hidden: false,
                    locked: false,
                },
            ]),
            getCachedContent: jest
                .fn()
                .mockResolvedValue([
                    { xtream_id: 4, title: '|ES| DAZN 1', category_id: 501 },
                ]),
            getCategories: jest
                .fn()
                .mockResolvedValue([
                    { category_id: '13', category_name: '|ES| ✪ DEPORTES' },
                ]),
            getContent: jest.fn().mockResolvedValue([
                {
                    stream_id: 4,
                    xtream_id: 4,
                    name: '|ES| DAZN 1',
                    title: '|ES| DAZN 1',
                    category_id: '13',
                },
            ]),
        };
        api = {
            getCategories: jest.fn().mockResolvedValue([]),
            getLiveStreams: jest.fn().mockResolvedValue([]),
        };
        database = {
            getXtreamImportStatus: jest.fn().mockResolvedValue('completed'),
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: XTREAM_DATA_SOURCE, useValue: dataSource },
                { provide: XtreamApiService, useValue: api },
                { provide: DatabaseService, useValue: database },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsXtreamSqliteDataSource: sqlite },
                },
                {
                    provide: ParentalLockService,
                    useValue: { version: signal(3) },
                },
            ],
        });
        return TestBed.inject(StoredLiveCatalog);
    }

    describe('in Electron', () => {
        it('reads the SQLite copy, with the provider ids', async () => {
            const stored = setup(true);

            const live = await stored.read('p1', CREDENTIALS);

            expect(database.getXtreamImportStatus).toHaveBeenCalledWith(
                'p1',
                'live'
            );
            expect(live).toEqual({
                categories: [
                    { category_id: '13', category_name: '|ES| ✪ DEPORTES' },
                ],
                streams: [
                    {
                        stream_id: 4,
                        name: '|ES| DAZN 1',
                        stream_icon: null,
                        category_id: '13',
                    },
                ],
            });
            expect(dataSource['getContent']).not.toHaveBeenCalled();
            expect(api['getLiveStreams']).not.toHaveBeenCalled();
            expect(stored.version()).toBe(3);
        });

        it('has no copy while the live import has not completed', async () => {
            const stored = setup(true);
            database.getXtreamImportStatus.mockResolvedValue('importing');

            expect(await stored.read('p1', CREDENTIALS)).toBeNull();
            expect(dataSource['getCachedContent']).not.toHaveBeenCalled();
        });

        it('downloads the first-run copy from the panel, without storing it', async () => {
            const stored = setup(true);

            await stored.download('p1', CREDENTIALS);

            expect(api['getCategories']).toHaveBeenCalledWith(
                CREDENTIALS,
                'live',
                { suppressErrorLog: true }
            );
            expect(api['getLiveStreams']).toHaveBeenCalledWith(CREDENTIALS, {
                suppressErrorLog: true,
            });
            expect(dataSource['getContent']).not.toHaveBeenCalled();
        });
    });

    describe('in the browser build', () => {
        it('reads the session cache through the data source', async () => {
            const stored = setup(false);

            const live = await stored.read('p1', CREDENTIALS);

            expect(dataSource['hasCategories']).toHaveBeenCalledWith(
                'p1',
                'live'
            );
            expect(dataSource['getContent']).toHaveBeenCalledWith(
                'p1',
                CREDENTIALS,
                'live'
            );
            expect(live?.streams).toEqual([
                {
                    stream_id: 4,
                    name: '|ES| DAZN 1',
                    stream_icon: null,
                    category_id: '13',
                },
            ]);
            expect(database.getXtreamImportStatus).not.toHaveBeenCalled();
        });

        it('has no copy before the session loaded the live catalog', async () => {
            const stored = setup(false);
            dataSource['hasContent'].mockResolvedValue(false);

            expect(await stored.read('p1', CREDENTIALS)).toBeNull();
            expect(dataSource['getContent']).not.toHaveBeenCalled();
        });

        it('downloads the first-run copy into the session cache the live view opens on', async () => {
            const stored = setup(false);

            const live = await stored.download('p1', CREDENTIALS);

            expect(dataSource['getCategories']).toHaveBeenCalledWith(
                'p1',
                CREDENTIALS,
                'live'
            );
            expect(dataSource['getContent']).toHaveBeenCalledWith(
                'p1',
                CREDENTIALS,
                'live'
            );
            expect(api['getLiveStreams']).not.toHaveBeenCalled();
            expect(live.streams).toHaveLength(1);
        });
    });
});
