import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { DialogService } from '@iptvnator/ui/components';
import {
    CollectionScope,
    ScopeToggleService,
    UnifiedCollectionItem,
    WorkspaceViewCommandService,
} from '@iptvnator/portal/shared/util';
import {
    UnifiedFavoritesDataService,
    UnifiedRecentDataService,
} from '@iptvnator/portal/shared/data-access';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import { UnifiedCollectionPageComponent } from './unified-collection-page.component';
import { UnifiedGridTabComponent } from './unified-grid-tab.component';
import { UnifiedLiveTabComponent } from './unified-live-tab.component';

@Component({
    selector: 'app-unified-grid-tab',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubGridTabComponent {
    readonly items = input.required<UnifiedCollectionItem[]>();
    readonly mode = input<'favorites' | 'recent'>('favorites');
    readonly contentType = input<'movie' | 'series'>('movie');
    readonly searchTerm = input('');
    readonly itemSelected = output<UnifiedCollectionItem>();
    readonly removeItem = output<UnifiedCollectionItem>();
}

@Component({
    selector: 'app-unified-live-tab',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubLiveTabComponent {}

const LIVE: UnifiedCollectionItem = {
    uid: 'xtream::source-1::live::14',
    name: '|ES| 24h',
    contentType: 'live',
    sourceType: 'xtream',
    playlistId: 'source-1',
    playlistName: 'TiagoTV',
    xtreamId: 14,
};
const MOVIE: UnifiedCollectionItem = {
    uid: 'xtream::source-1::movie::7',
    name: 'Movie',
    contentType: 'movie',
    sourceType: 'xtream',
    playlistId: 'source-1',
    playlistName: 'TiagoTV',
    xtreamId: 7,
};
const SERIES: UnifiedCollectionItem = {
    ...MOVIE,
    uid: 'xtream::source-1::series::8',
    name: 'Series',
    contentType: 'series',
    xtreamId: 8,
};

/**
 * TiagoTV's Mi lista and Recently viewed (`channelRow`): their channels a
 * row of cards.
 */
describe('UnifiedCollectionPageComponent channel row', () => {
    let fixture: ComponentFixture<UnifiedCollectionPageComponent>;
    const favoritesData = {
        getFavorites: jest.fn(),
        removeFavorite: jest.fn().mockResolvedValue(undefined),
    };
    const recentData = {
        getRecentItems: jest.fn(),
        removeRecentItem: jest.fn().mockResolvedValue(undefined),
        removeRecentItemsBatch: jest.fn().mockResolvedValue(undefined),
    };
    const dialog = { openConfirmDialog: jest.fn() };

    beforeEach(async () => {
        jest.clearAllMocks();
        const params = new BehaviorSubject(convertToParamMap({}));
        const route = {
            snapshot: {
                paramMap: convertToParamMap({}),
                queryParamMap: convertToParamMap({}),
                queryParams: {},
                params: {},
                data: {},
                parent: null,
            },
            paramMap: params.asObservable(),
            queryParamMap: params.asObservable(),
            pathFromRoot: [] as ActivatedRoute[],
        };
        route.pathFromRoot = [route as unknown as ActivatedRoute];

        await TestBed.configureTestingModule({
            imports: [
                UnifiedCollectionPageComponent,
                TranslateModule.forRoot(),
            ],
            providers: [
                { provide: MatSnackBar, useValue: { open: jest.fn() } },
                { provide: ActivatedRoute, useValue: route },
                {
                    provide: Router,
                    useValue: { navigate: jest.fn(), url: '/workspace' },
                },
                {
                    provide: Store,
                    useValue: { selectSignal: () => signal([]) },
                },
                {
                    provide: ScopeToggleService,
                    useValue: {
                        getScope: () => signal<CollectionScope>('all'),
                        setScope: jest.fn(),
                    },
                },
                {
                    provide: UnifiedFavoritesDataService,
                    useValue: favoritesData,
                },
                { provide: UnifiedRecentDataService, useValue: recentData },
                { provide: DialogService, useValue: dialog },
                {
                    provide: WorkspaceViewCommandService,
                    useValue: { registerCommand: () => jest.fn() },
                },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsEpg: false },
                },
            ],
        })
            .overrideComponent(UnifiedCollectionPageComponent, {
                remove: {
                    imports: [UnifiedGridTabComponent, UnifiedLiveTabComponent],
                },
                add: { imports: [StubGridTabComponent, StubLiveTabComponent] },
            })
            .compileComponents();

        window.history.replaceState({}, document.title);
        fixture = TestBed.createComponent(UnifiedCollectionPageComponent);
        fixture.componentRef.setInput('mode', 'favorites');
        fixture.componentRef.setInput('defaultScope', 'all');
        fixture.componentRef.setInput('channelRow', true);
    });

    const element = () => fixture.nativeElement as HTMLElement;
    const settle = async () => {
        await fixture.whenStable();
        // The load's own promise chain, then the tab it picks.
        for (let i = 0; i < 8; i++) {
            await Promise.resolve();
        }
        fixture.detectChanges();
    };
    const load = async (items: UnifiedCollectionItem[]) => {
        favoritesData.getFavorites.mockResolvedValueOnce(items);
        fixture.detectChanges();
        await settle();
    };
    const grid = () =>
        fixture.debugElement.query(By.directive(StubGridTabComponent))
            ?.componentInstance as StubGridTabComponent | undefined;

    it('shows the channels as a row first, then the movies and series', async () => {
        await load([LIVE, MOVIE, SERIES]);

        const content = element().querySelector('.collection-content');
        expect(content?.classList).toContain('collection-content--rows');
        expect(content?.firstElementChild?.tagName.toLowerCase()).toBe(
            'app-collection-channel-row'
        );
        expect(
            element().querySelectorAll('[data-test-id="my-list-channel"]')
                .length
        ).toBe(1);
        // No Live tab: the channels are not a list with a player.
        expect(
            fixture.debugElement.query(By.directive(StubLiveTabComponent))
        ).toBeNull();
        expect(grid()?.items()).toEqual([MOVIE]);
        // The type chips sit over the grid, not in the page's header.
        const toggle = element().querySelector('.content-toggle');
        expect(toggle?.closest('.collection-section-head')).not.toBeNull();
        expect(toggle?.textContent).not.toContain('PORTALS.LIVE_TV');
    });

    it('names the one type there is over its grid', async () => {
        await load([LIVE, SERIES]);

        expect(
            element().querySelector('.collection-section-title')?.textContent
        ).toContain('PORTALS.SERIES');
        expect(element().querySelector('.content-toggle')).toBeNull();
        expect(grid()?.items()).toEqual([SERIES]);
    });

    it('takes a channel off from its heart', async () => {
        await load([LIVE, MOVIE]);

        (
            element().querySelector(
                '[data-test-id="my-list-channel-remove"]'
            ) as HTMLButtonElement
        ).click();
        await settle();

        expect(favoritesData.removeFavorite).toHaveBeenCalledWith(LIVE);
        expect(
            element().querySelector('[data-test-id="my-list-channels"]')
        ).toBeNull();
        expect(grid()?.items()).toEqual([MOVIE]);
    });

    it('says where the hearts are when there is nothing yet', async () => {
        await load([]);

        expect(
            element().querySelector('app-empty-state')?.textContent
        ).toContain('WORKSPACE.MY_LIST.EMPTY_BODY');
    });

    it('shows no empty state while it holds channels only', async () => {
        await load([LIVE]);

        expect(element().querySelector('app-empty-state')).toBeNull();
        expect(
            element().querySelector('[data-test-id="my-list-channels"]')
        ).not.toBeNull();
        expect(element().querySelector('.collection-section-head')).toBeNull();
    });

    describe('on Recently viewed', () => {
        const OLDER_LIVE: UnifiedCollectionItem = {
            ...LIVE,
            uid: 'xtream::source-1::live::15',
            name: '|AR| TN',
            xtreamId: 15,
        };
        const loadRecent = async (items: UnifiedCollectionItem[]) => {
            fixture.componentRef.setInput('mode', 'recent');
            recentData.getRecentItems.mockResolvedValueOnce(items);
            fixture.detectChanges();
            await settle();
        };
        const cardNames = () =>
            Array.from(
                element().querySelectorAll('[data-test-id="my-list-channel"]')
            ).map((card) => card.querySelector('.channel__name')?.textContent);

        it('shows the channels as cards, last watched first, then the titles', async () => {
            await loadRecent([LIVE, SERIES, OLDER_LIVE, MOVIE]);

            const content = element().querySelector('.collection-content');
            expect(content?.firstElementChild?.tagName.toLowerCase()).toBe(
                'app-collection-channel-row'
            );
            expect(cardNames()).toEqual(['24h', 'TN']);
            // No Live tab, no framed player: a card plays on "En vivo".
            expect(
                fixture.debugElement.query(By.directive(StubLiveTabComponent))
            ).toBeNull();
            expect(
                element().querySelector('.content-toggle')?.textContent
            ).not.toContain('PORTALS.LIVE_TV');
            expect(grid()?.items()).toEqual([MOVIE]);
        });

        it("clears the channels from the row's bin, keeping the titles", async () => {
            await loadRecent([LIVE, OLDER_LIVE, SERIES]);

            (
                element().querySelector(
                    '[data-test-id="channels-clear"]'
                ) as HTMLButtonElement
            ).click();
            const [config] = dialog.openConfirmDialog.mock.calls[0];
            await config.onConfirm();
            await settle();

            expect(recentData.removeRecentItemsBatch).toHaveBeenCalledWith([
                LIVE,
                OLDER_LIVE,
            ]);
            expect(
                element().querySelector('[data-test-id="my-list-channels"]')
            ).toBeNull();
            expect(grid()?.items()).toEqual([SERIES]);
        });

        it('takes one channel out of the history from its ×', async () => {
            await loadRecent([LIVE, OLDER_LIVE]);

            (
                element().querySelector(
                    '[data-test-id="my-list-channel-remove"]'
                ) as HTMLButtonElement
            ).click();
            await settle();

            expect(recentData.removeRecentItem).toHaveBeenCalledWith(LIVE);
            expect(favoritesData.removeFavorite).not.toHaveBeenCalled();
            expect(cardNames()).toEqual(['TN']);
        });

        it('keeps its own empty state', async () => {
            await loadRecent([]);

            expect(
                element().querySelector('app-empty-state')?.textContent
            ).toContain('WORKSPACE.GLOBAL_RECENT.NO_ITEMS_BODY');
        });
    });
});
