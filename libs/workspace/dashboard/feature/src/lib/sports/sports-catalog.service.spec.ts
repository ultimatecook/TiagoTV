import { signal, type DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import { SportsCatalogService } from './sports-catalog.service';

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

describe('SportsCatalogService', () => {
    let service: SportsCatalogService;
    let getLiveStreams: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-10-18T18:00:00Z'));
        localStorage.clear();
        getLiveStreams = jest.fn().mockResolvedValue([
            {
                stream_id: 1,
                name: 'Live | Girona FC - FC Andorra | LaLiga | ES',
                category_id: 1,
            },
            { stream_id: 2, name: '|ES| DAZN 1 ᴴᴰ', category_id: 1 },
        ]);
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: XtreamApiService,
                    useValue: {
                        getCategories: jest.fn().mockResolvedValue([
                            {
                                category_id: 1,
                                category_name: '|ES| ✪ DEPORTES',
                            },
                        ]),
                        getLiveStreams,
                    },
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

    it('reloads the catalog while a sports view is open, and stops after', async () => {
        const view = fakeDestroyRef();
        service.keepFresh(view.ref);
        await jest.advanceTimersByTimeAsync(0);

        expect(getLiveStreams).toHaveBeenCalledTimes(1);
        expect(service.today().map((match) => match.title)).toEqual([
            'Girona FC - FC Andorra',
        ]);
        expect(service.liveChannels().map((tile) => tile.brand.id)).toEqual([
            'dazn',
        ]);

        // The whole line-up is heavy for the provider: every 10 minutes.
        await jest.advanceTimersByTimeAsync(9 * MINUTE);
        expect(getLiveStreams).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(2 * MINUTE);
        expect(getLiveStreams).toHaveBeenCalledTimes(2);

        view.destroy();
        await jest.advanceTimersByTimeAsync(30 * MINUTE);
        expect(getLiveStreams).toHaveBeenCalledTimes(2);
    });

    it('keeps refreshing until the last open view closes', async () => {
        const home = fakeDestroyRef();
        const page = fakeDestroyRef();
        service.keepFresh(home.ref);
        service.keepFresh(page.ref);
        await jest.advanceTimersByTimeAsync(0);
        expect(getLiveStreams).toHaveBeenCalledTimes(1);

        home.destroy();
        await jest.advanceTimersByTimeAsync(11 * MINUTE);
        expect(getLiveStreams).toHaveBeenCalledTimes(2);

        page.destroy();
        await jest.advanceTimersByTimeAsync(30 * MINUTE);
        expect(getLiveStreams).toHaveBeenCalledTimes(2);
    });

    it('drops a "Live" match that has run longer than a match lasts', async () => {
        service.keepFresh(fakeDestroyRef().ref);
        await jest.advanceTimersByTimeAsync(0);
        const [match] = service.today();
        expect(service.isOver(match)).toBe(false);

        // The provider keeps "Live" in the name after the final whistle.
        await jest.advanceTimersByTimeAsync(151 * MINUTE);

        expect(service.today()).toEqual([]);
        expect(service.isOver(match)).toBe(true);
    });

    it('shares the live catalog it loaded with the other views', async () => {
        expect(service.liveCatalog()).toBeNull();

        await service.load();

        expect(
            service.liveCatalog()?.categories.map((c) => c.category_name)
        ).toEqual(['|ES| ✪ DEPORTES']);
        expect(service.liveCatalog()?.streams).toHaveLength(2);
    });
});
