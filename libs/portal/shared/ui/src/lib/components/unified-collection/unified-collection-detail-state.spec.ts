import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import {
    buildGlobalCollectionDetailNavigationTarget,
    getGlobalFavoriteNavigation,
    getOpenCollectionDetailItemState,
    OPEN_COLLECTION_DETAIL_STATE_KEY,
    ScopeToggleService,
    UnifiedCollectionItem,
} from '@iptvnator/portal/shared/util';
import { of } from 'rxjs';
import { createCollectionDetailState } from './unified-collection-detail-state';
import { CollectionViewStateHistory } from './unified-collection-history';
import { createCollectionScopeState } from './unified-collection-scope';

describe('dashboard favorite detail handoff', () => {
    afterEach(() => window.history.replaceState({}, document.title));

    it.each(['movie', 'series'] as const)(
        'validates a %s from another playlist against the global collection',
        (type) => {
            const favorite = {
                id: 77,
                favorite_id: 11,
                title: 'Saved title',
                type,
                source: 'xtream' as const,
                playlist_id: 'source-B',
                playlist_name: 'Source B',
                xtream_id: 77,
                category_id: 12,
                poster_url: '',
                added_at: '2026-10-01T00:00:00.000Z',
                catalog_status: 'present' as const,
            };
            window.history.replaceState(
                getGlobalFavoriteNavigation(favorite).state,
                document.title
            );
            const paramMap = convertToParamMap({});
            TestBed.configureTestingModule({
                providers: [
                    {
                        provide: Router,
                        useValue: { url: '/workspace/global-favorites' },
                    },
                    {
                        provide: ActivatedRoute,
                        useValue: {
                            snapshot: { queryParamMap: paramMap },
                            queryParamMap: of(paramMap),
                        },
                    },
                    {
                        provide: ScopeToggleService,
                        useValue: { getScope: () => signal('playlist') },
                    },
                ],
            });
            const current = signal<UnifiedCollectionItem[]>([
                {
                    uid: `xtream::source-B::${type}:77`,
                    name: favorite.title,
                    contentType: type,
                    sourceType: 'xtream',
                    playlistId: 'source-B',
                    playlistName: 'Source B',
                    xtreamId: 77,
                    favoriteId: 11,
                    catalogStatus: 'present',
                },
            ]);
            const detail = TestBed.runInInjectionContext(() => {
                const history = new CollectionViewStateHistory();
                const scope = createCollectionScopeState({
                    scopeKey: signal('favorites'),
                    playlistId: signal('active-A'),
                    defaultScope: signal('playlist'),
                    historyScope: computed(() => history.current()?.scope),
                });
                return createCollectionDetailState({
                    mode: signal('favorites'),
                    items: computed(() =>
                        scope.effective() === 'all' ? current() : []
                    ),
                    isLoading: signal(false),
                    portalType: signal(undefined),
                    detailTemplate: signal({}),
                    onOpen: jest.fn(),
                    onClear: jest.fn(),
                });
            });
            detail.syncFromHistory();
            expect(detail.item()).toEqual(current()[0]);

            // The same handoff must not trust stale dashboard availability.
            current.set([{ ...current()[0], catalogStatus: 'missing' }]);
            detail.syncFromHistory();
            expect(detail.item()).toBeNull();

            window.history.replaceState(
                getGlobalFavoriteNavigation(favorite).state,
                document.title
            );
            current.set([]);
            detail.syncFromHistory();
            expect(detail.item()).toBeNull();
        }
    );
});

describe('series resume handoff', () => {
    afterEach(() => window.history.replaceState({}, document.title));

    it('resumes once: Back, Forward or a reload onto the entry only show the series', () => {
        const series: UnifiedCollectionItem = {
            uid: 'xtream::source-A::series:9016',
            name: 'Miércoles',
            contentType: 'series',
            sourceType: 'xtream',
            playlistId: 'source-A',
            playlistName: 'Source A',
            xtreamId: 9016,
            categoryId: '2331',
        };
        const resume = {
            seriesXtreamId: 9016,
            contentXtreamId: 90162,
            seasonNumber: 1,
            episodeNumber: 2,
        };
        // The Home hero's Continue on a series.
        window.history.replaceState(
            buildGlobalCollectionDetailNavigationTarget('recent', series, resume)
                .state,
            document.title
        );
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue: { url: '/workspace/global-recent' } },
            ],
        });
        const items = signal<UnifiedCollectionItem[]>([series]);
        const detail = TestBed.runInInjectionContext(() =>
            createCollectionDetailState({
                mode: signal('recent'),
                items,
                isLoading: signal(false),
                portalType: signal(undefined),
                detailTemplate: signal({}),
                onOpen: jest.fn(),
                onClear: jest.fn(),
            })
        );

        detail.syncFromHistory();
        expect(detail.item()?.uid).toBe(series.uid);
        expect(detail.seriesResume()).toEqual(resume);
        // The entry keeps the detail, not the handoff.
        const left = window.history.state;
        expect(getOpenCollectionDetailItemState(left)?.item.uid).toBe(
            series.uid
        );
        expect(left[OPEN_COLLECTION_DETAIL_STATE_KEY].seriesResume).toBeUndefined();

        // The rows refresh while the episode plays: the handoff stays put.
        items.set([{ ...series }]);
        detail.syncFromHistory();
        expect(detail.seriesResume()).toEqual(resume);

        // Back to the list, then Forward (or a reload) onto the entry.
        window.history.replaceState({}, document.title);
        detail.syncFromHistory();
        expect(detail.item()).toBeNull();
        window.history.replaceState(left, document.title);
        detail.syncFromHistory();
        expect(detail.item()?.uid).toBe(series.uid);
        expect(detail.seriesResume()).toBeNull();
    });
});

describe('closing an inline detail', () => {
    const movie: UnifiedCollectionItem = {
        uid: 'xtream::source-A::movie:50041',
        name: 'Hustle',
        contentType: 'movie',
        sourceType: 'xtream',
        playlistId: 'source-A',
        playlistName: 'Source A',
        xtreamId: 50041,
    };

    function openDetail(previousSameDocument: boolean) {
        Object.defineProperty(window, 'navigation', {
            configurable: true,
            value: {
                currentEntry: { index: 1 },
                entries: () => [{ sameDocument: previousSameDocument }, {}],
            },
        });
        window.history.replaceState(
            buildGlobalCollectionDetailNavigationTarget('favorites', movie)
                .state,
            document.title
        );
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: Router,
                    useValue: { url: '/workspace/global-favorites' },
                },
            ],
        });
        const detail = TestBed.runInInjectionContext(() =>
            createCollectionDetailState({
                mode: signal('favorites'),
                items: signal([movie]),
                isLoading: signal(false),
                portalType: signal(undefined),
                detailTemplate: signal({}),
                onOpen: jest.fn(),
                onClear: jest.fn(),
            })
        );
        detail.syncFromHistory();
        return detail;
    }

    afterEach(() => {
        delete (window as { navigation?: unknown }).navigation;
        window.history.replaceState({}, document.title);
        jest.restoreAllMocks();
    });

    it('steps history Back to the list it was opened from', () => {
        const back = jest
            .spyOn(window.history, 'back')
            .mockImplementation(() => undefined);
        const detail = openDetail(true);

        detail.context()?.close();

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('shows the list in place when the detail opened the session', () => {
        // A reload or a deep link: history Back would reload or leave the app.
        const back = jest
            .spyOn(window.history, 'back')
            .mockImplementation(() => undefined);
        const detail = openDetail(false);
        expect(detail.item()?.uid).toBe(movie.uid);

        detail.context()?.close();

        expect(back).not.toHaveBeenCalled();
        expect(detail.item()).toBeNull();
        expect(getOpenCollectionDetailItemState(window.history.state)).toBeNull();
    });
});
