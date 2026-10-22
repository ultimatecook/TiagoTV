import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import { LazySnackBar } from '@iptvnator/services/lazy-snack-bar';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import { ChannelFavoritesService } from './channel-favorites.service';

const flush = () => new Promise((resolve) => setTimeout(resolve));
/** The stored row's id back to its stream (the browser build keys by it). */
const streamOf = (id: number) => (id > 5000 ? id - 5000 : id);

describe('ChannelFavoritesService', () => {
    const source = signal<PlaylistMeta | null>({
        _id: 'source-1',
    } as PlaylistMeta);
    let rows: { xtream_id: number; type: string }[];
    const dataSource = {
        getFavorites: jest.fn(async () => rows),
        // The stored catalog's row: its id is not the stream's.
        getContentByXtreamId: jest.fn(async (streamId: number) =>
            streamId === 404 ? null : { id: streamId + 5000 }
        ),
        // The store itself: what the list reads back after a write.
        addFavorite: jest.fn(async (target: { id: number }) => {
            rows.push({ xtream_id: streamOf(target.id), type: 'live' });
        }),
        removeFavorite: jest.fn(async (target: { id: number }) => {
            rows = rows.filter((row) => row.xtream_id !== streamOf(target.id));
        }),
    };
    const runtime = { supportsXtreamSqliteDataSource: true };
    const snackBar = { open: jest.fn(async () => null) };
    let service: ChannelFavoritesService;

    beforeEach(async () => {
        jest.clearAllMocks();
        rows = [
            { xtream_id: 10, type: 'live' },
            // A movie with a stream's number is not a channel.
            { xtream_id: 21, type: 'movie' },
        ];
        source.set({ _id: 'source-1' } as PlaylistMeta);
        runtime.supportsXtreamSqliteDataSource = true;
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                { provide: SportsCatalogService, useValue: { source } },
                { provide: XTREAM_DATA_SOURCE, useValue: dataSource },
                { provide: RuntimeCapabilitiesService, useValue: runtime },
                { provide: LazySnackBar, useValue: snackBar },
            ],
        });
        service = TestBed.inject(ChannelFavoritesService);
        // Its first read, as the source is known.
        TestBed.tick();
        await flush();
    });

    it('reads the source’s live favourites', () => {
        expect(dataSource.getFavorites).toHaveBeenCalledWith('source-1');
        expect(service.has(10)).toBe(true);
        expect(service.has(21)).toBe(false);
        // A tile is on the list when any of its copies is.
        expect(service.has([11, 10])).toBe(true);
        expect(service.has([11, 12])).toBe(false);
    });

    it('adds a channel against its stored row, as the live view’s star does', async () => {
        await expect(service.toggle(20, [20, 22])).resolves.toBe(true);

        expect(dataSource.getContentByXtreamId).toHaveBeenCalledWith(
            20,
            'source-1',
            'live'
        );
        expect(dataSource.addFavorite).toHaveBeenCalledWith(
            { id: 5020, type: 'live' },
            'source-1'
        );
        expect(service.has(20)).toBe(true);
    });

    it('takes every copy of a tile off the list', async () => {
        rows = [
            { xtream_id: 30, type: 'live' },
            { xtream_id: 31, type: 'live' },
        ];
        await service.refresh();

        await expect(service.toggle(32, [30, 31, 32])).resolves.toBe(false);

        expect(dataSource.removeFavorite).toHaveBeenCalledTimes(2);
        expect(dataSource.removeFavorite).toHaveBeenCalledWith(
            { id: 5030, type: 'live' },
            'source-1'
        );
        expect(dataSource.removeFavorite).toHaveBeenCalledWith(
            { id: 5031, type: 'live' },
            'source-1'
        );
        expect(dataSource.addFavorite).not.toHaveBeenCalled();
    });

    it('reads the list again once written', async () => {
        dataSource.getFavorites.mockClear();
        await service.toggle(20);
        await flush();

        expect(dataSource.getFavorites).toHaveBeenCalledTimes(1);
        expect(service.has(20)).toBe(true);
    });

    it('puts the heart back and says so when the write fails', async () => {
        // Not in the stored catalog (a first run, before the import).
        await expect(service.toggle(404)).resolves.toBeNull();

        expect(service.has(404)).toBe(false);
        expect(dataSource.addFavorite).not.toHaveBeenCalled();
        expect(snackBar.open).toHaveBeenCalledWith(
            'WORKSPACE.MY_LIST.SAVE_FAILED',
            undefined,
            { duration: 6000 }
        );
    });

    it('keys the browser build’s favourites by the stream itself', async () => {
        runtime.supportsXtreamSqliteDataSource = false;

        await service.toggle(404);

        expect(dataSource.addFavorite).toHaveBeenCalledWith(
            { id: 404, type: 'live' },
            'source-1'
        );
    });

    it('knows no list without a source, or another source’s', async () => {
        source.set(null);
        expect(service.has(10)).toBe(false);
        await expect(service.toggle(10)).resolves.toBeNull();
        expect(dataSource.removeFavorite).not.toHaveBeenCalled();
    });
});
