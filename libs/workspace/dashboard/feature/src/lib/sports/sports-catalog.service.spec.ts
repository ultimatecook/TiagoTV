import { signal, type DestroyRef, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import type { LiveCatalog } from './live-catalog';
import { SportsCatalogService } from './sports-catalog.service';
import { StoredLiveCatalog } from './stored-live-catalog';

const MINUTE = 60_000;

/** A component's DestroyRef, destroyed on demand. */
function fakeDestroyRef(): { ref: DestroyRef; destroy: () => void } {
    const callbacks: (() => void)[] = [];
    return {
        ref: {
            onDestroy: (callback: () => void) => {
                callbacks.push(callback);
                return () => undefined;
            },
            destroyed: false,
        } as unknown as DestroyRef,
        destroy: () => callbacks.forEach((callback) => callback()),
    };
}

/** The catalog as the app stored it, days ago: yesterday's event names. */
const STORED: LiveCatalog = {
    categories: [
        { category_id: '1', category_name: '|ES| ✪ DEPORTES' },
        { category_id: '2', category_name: '|ES| ✪ DAZN EVENT' },
        { category_id: '3', category_name: '|FR| ✪ SPORTS' },
        { category_id: '4', category_name: '|ES| ✪ CINE' },
    ],
    streams: [
        {
            stream_id: 1,
            name: 'Live | Real Betis - Sevilla FC | LaLiga | ES',
            category_id: '1',
        },
        { stream_id: 2, name: '|ES| DAZN 1 ᴴᴰ', category_id: '1' },
        { stream_id: 3, name: 'ES | No Event', category_id: '2' },
        {
            stream_id: 4,
            name: 'Live | PSG - OM | Ligue 1 | FR',
            category_id: '3',
        },
        { stream_id: 5, name: '|ES| CINE 1', category_id: '4' },
    ],
};

/** What the panel lists today, per category. */
const TODAY: Record<string, object[]> = {
    '1': [
        {
            stream_id: 1,
            name: 'Live | Girona FC - FC Andorra | LaLiga | ES',
            category_id: '1',
        },
        { stream_id: 2, name: '|ES| DAZN 1 ᴴᴰ', category_id: '1' },
    ],
    '2': [
        {
            stream_id: 3,
            name: 'Next | 2026-10-18 | 20:00 (GMT) | Valencia CF - Getafe CF | LaLiga | ES',
            category_id: '2',
        },
    ],
};

describe('SportsCatalogService', () => {
    let service: SportsCatalogService;
    let getLiveStreams: jest.Mock;
    let getCategories: jest.Mock;
    let read: jest.Mock;
    let download: jest.Mock;
    let version: WritableSignal<number>;

    /** The panel requests made, by category ('all' for the line-up). */
    const requests = () =>
        getLiveStreams.mock.calls.map(
            ([, options]) => options?.categoryId ?? 'all'
        );
    const todayTitles = () => service.today().map((match) => match.title);

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-18T18:00:00Z'));
        localStorage.clear();
        getLiveStreams = jest.fn(
            async (_credentials: unknown, options?: { categoryId?: string }) =>
                options?.categoryId
                    ? (TODAY[options.categoryId] ?? [])
                    : Object.values(TODAY).reduce<object[]>(
                          (all, list) => all.concat(list),
                          []
                      )
        );
        getCategories = jest.fn();
        read = jest.fn().mockResolvedValue(STORED);
        download = jest.fn();
        version = signal(0);
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: XtreamApiService,
                    useValue: { getCategories, getLiveStreams },
                },
                {
                    provide: StoredLiveCatalog,
                    useValue: { read, download, version },
                },
                {
                    provide: Store,
                    useValue: {
                        selectSignal: () =>
                            signal([
                                {
                                    _id: 'source-1',
                                    serverUrl: 'http://provider.example',
                                    username: 'user',
                                    password: 'secret',
                                },
                            ]),
                    },
                },
                { provide: Router, useValue: { navigate: jest.fn() } },
            ],
        });
        service = TestBed.inject(SportsCatalogService);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('reads the stored copy instead of downloading the whole line-up', async () => {
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(5_000);

        expect(read).toHaveBeenCalledWith('source-1', {
            serverUrl: 'http://provider.example',
            username: 'user',
            password: 'secret',
        });
        expect(download).not.toHaveBeenCalled();
        expect(getCategories).not.toHaveBeenCalled();
        expect(requests()).not.toContain('all');
        expect(service.liveChannels().map((tile) => tile.brand.id)).toEqual([
            'dazn',
        ]);
        expect(
            service.liveCatalog()?.categories.map((c) => c.category_name)
        ).toEqual([
            '|ES| ✪ DEPORTES',
            '|ES| ✪ DAZN EVENT',
            '|FR| ✪ SPORTS',
            '|ES| ✪ CINE',
        ]);
    });

    it('reloads only the Spanish and English event categories, one at a time', async () => {
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(0);
        expect(requests()).toEqual(['1']);

        await jest.advanceTimersByTimeAsync(500);
        expect(requests()).toEqual(['1', '2']);
        expect(getLiveStreams).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ categoryId: '2' })
        );

        await jest.advanceTimersByTimeAsync(5_000);
        expect(requests()).toEqual(['1', '2']);
        expect(todayTitles()).toEqual([
            'Girona FC - FC Andorra',
            'Valencia CF - Getafe CF',
        ]);
        // The fresh lists take the stored ones' place; the rest stays.
        expect(service.liveCatalog()?.streams.map((s) => s.name)).toEqual([
            'Live | Girona FC - FC Andorra | LaLiga | ES',
            '|ES| DAZN 1 ᴴᴰ',
            'Next | 2026-10-18 | 20:00 (GMT) | Valencia CF - Getafe CF | LaLiga | ES',
            'Live | PSG - OM | Ligue 1 | FR',
            '|ES| CINE 1',
        ]);
    });

    it('never shows the stored event names, only reloaded ones', async () => {
        getLiveStreams.mockImplementation(() => new Promise(() => undefined));
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(0);

        // The rest of the catalog shows while the events reload.
        expect(service.liveChannels().map((tile) => tile.brand.id)).toEqual([
            'dazn',
        ]);
        expect(todayTitles()).toEqual([]);
        expect(service.liveCatalog()?.streams.map((s) => s.name)).not.toContain(
            'Live | Real Betis - Sevilla FC | LaLiga | ES'
        );
        expect(service.loading()).toBe(true);
    });

    it('reloads the event categories every 10 minutes while a sports view is open, and stops after', async () => {
        const view = fakeDestroyRef();
        service.keepFresh(view.ref);
        await jest.advanceTimersByTimeAsync(5_000);
        expect(requests()).toEqual(['1', '2']);

        await jest.advanceTimersByTimeAsync(9 * MINUTE);
        expect(requests()).toHaveLength(2);

        await jest.advanceTimersByTimeAsync(2 * MINUTE);
        expect(requests()).toEqual(['1', '2', '1', '2']);
        expect(download).not.toHaveBeenCalled();

        view.destroy();
        await jest.advanceTimersByTimeAsync(30 * MINUTE);
        expect(requests()).toHaveLength(4);
    });

    it('keeps refreshing until the last open view closes', async () => {
        const home = fakeDestroyRef();
        const page = fakeDestroyRef();
        service.keepFresh(home.ref);
        service.keepFresh(page.ref);
        await jest.advanceTimersByTimeAsync(5_000);
        expect(requests()).toHaveLength(2);

        home.destroy();
        await jest.advanceTimersByTimeAsync(11 * MINUTE);
        expect(requests()).toHaveLength(4);

        page.destroy();
        await jest.advanceTimersByTimeAsync(30 * MINUTE);
        expect(requests()).toHaveLength(4);
    });

    it('keeps the last fresh list of a category whose reload fails', async () => {
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(5_000);

        getLiveStreams.mockRejectedValue(new Error('panel busy'));
        await jest.advanceTimersByTimeAsync(11 * MINUTE);

        // The round stopped at the first failure.
        expect(requests()).toEqual(['1', '2', '1']);
        expect(service.failed()).toBe(false);
        expect(todayTitles()).toEqual([
            'Girona FC - FC Andorra',
            'Valencia CF - Getafe CF',
        ]);
    });

    it('reads the stored copy again, without a request, when the parental lock changes', async () => {
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(5_000);
        expect(read).toHaveBeenCalledTimes(1);

        read.mockResolvedValue({
            categories: STORED.categories.slice(1),
            streams: STORED.streams.slice(2),
        });
        version.set(1);
        await jest.advanceTimersByTimeAsync(MINUTE);

        expect(read).toHaveBeenCalledTimes(2);
        expect(requests()).toHaveLength(2);
        expect(service.liveChannels()).toEqual([]);
        expect(todayTitles()).toEqual(['Valencia CF - Getafe CF']);
    });

    it('downloads the whole line-up once while nothing is stored yet', async () => {
        read.mockResolvedValue(null);
        download.mockResolvedValue({
            categories: STORED.categories,
            streams: TODAY['1'].concat(TODAY['2']),
        });
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(0);

        expect(download).toHaveBeenCalledTimes(1);
        expect(requests()).toEqual([]);
        expect(todayTitles()).toEqual([
            'Girona FC - FC Andorra',
            'Valencia CF - Getafe CF',
        ]);

        // Later rounds reload only the event categories of that copy.
        await jest.advanceTimersByTimeAsync(11 * MINUTE);
        expect(download).toHaveBeenCalledTimes(1);
        expect(requests()).toEqual(['1', '2']);

        // Once the app has stored the catalog, the Home reads that.
        read.mockResolvedValue(STORED);
        await jest.advanceTimersByTimeAsync(10 * MINUTE + 5_000);
        expect(read).toHaveBeenCalledTimes(3);
        expect(download).toHaveBeenCalledTimes(1);
        expect(service.liveCatalog()?.streams).toHaveLength(5);
    });

    it('fails only when nothing could be loaded', async () => {
        read.mockResolvedValue(null);
        download.mockRejectedValue(new Error('offline'));

        await service.load();

        expect(service.failed()).toBe(true);
        expect(service.liveCatalog()).toBeNull();
    });

    it('drops a "Live" match that has run longer than a match lasts', async () => {
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(5_000);
        const [match] = service.today();
        expect(match.title).toBe('Girona FC - FC Andorra');
        expect(service.isOver(match)).toBe(false);

        // The provider keeps "Live" in the name after the final whistle.
        await jest.advanceTimersByTimeAsync(151 * MINUTE);

        expect(todayTitles()).not.toContain('Girona FC - FC Andorra');
        expect(service.isOver(match)).toBe(true);
    });

    it('shares the live catalog it loaded with the other views', async () => {
        expect(service.liveCatalog()).toBeNull();

        const loading = service.load();
        await jest.advanceTimersByTimeAsync(5_000);
        await loading;

        expect(
            service.liveCatalog()?.categories.map((c) => c.category_name)
        ).toContain('|ES| ✪ DEPORTES');
        expect(service.liveCatalog()?.streams).toHaveLength(5);
    });
});
