import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MockPipe } from 'ng-mocks';
import { TranslatePipe } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import {
    LiveLayoutSidebarStateService,
    PORTAL_PLAYER,
} from '@iptvnator/portal/shared/util';
import {
    FavoritesService,
    XtreamStore,
    XtreamUrlService,
} from '@iptvnator/portal/xtream/data-access';
import {
    EpgArchiveCopyService,
    EpgArchiveDownloadService,
    EpgListViewComponent,
    EpgTimelineComponent,
} from '@iptvnator/ui/epg';
import { WebPlayerViewComponent } from '@iptvnator/ui/playback';
import {
    ChannelFeedStripComponent,
    GridListComponent,
} from '@iptvnator/portal/shared/ui';
import {
    DatabaseService,
    ParentalLockService,
    RuntimeCapabilitiesService,
    SettingsStore,
} from '@iptvnator/services';
import { PortalChannelsListComponent } from '../portal-channels-list/portal-channels-list.component';
import { LiveStreamLayoutComponent } from './live-stream-layout.component';
import {
    playlist,
    StubEpgTimelineComponent,
    StubGridListComponent,
    StubPortalChannelsListComponent,
    StubWebPlayerViewComponent,
} from './live-stream-layout-stubs.spec-data';
import type { XtreamLiveChannelItem } from './xtream-live-channel-navigation.service';

const translate = MockPipe(
    TranslatePipe,
    (key: string, params?: Record<string, unknown>) =>
        params ? `${key} ${JSON.stringify(params)}` : key
);

// The real catalog's names, as the PWA store holds them.
const categories = [
    { category_id: '10', category_name: '|LAT|  ✪ ARGENTINA' },
    { category_id: '20', category_name: '|US| ✪ SPORTS' },
    { category_id: '30', category_name: '|ES| ✪ DEPORTES' },
    { category_id: '40', category_name: '|US| ✪ NBA PPV', hidden: true },
];

function channel(
    xtream_id: number,
    name: string,
    category_id: string
): XtreamLiveChannelItem {
    return {
        xtream_id,
        name,
        title: name,
        category_id,
        stream_icon: `http://logos.example/${xtream_id}.png`,
    };
}

const espn = channel(1, '|ARG| ESPN', '10');
const espn2 = channel(2, '|ARG| ESPN 2', '10');
const espnPlus = channel(3, '|ARG| ESPN+', '10');
const espnUs = channel(4, '|US| ESPN USA', '20');
const espnHidden = channel(5, '|US| ESPN 3 ᴴᴰ', '40');
const teledeporte = channel(6, '|ES| Teledeporte', '30');
const liveStreams = [espn, espn2, espnPlus, espnUs, espnHidden, teledeporte];

/**
 * TiagoTV's "other feeds" strip under the live player. Split from
 * `live-stream-layout.component.spec.ts`, which sits at the spec line cap.
 */
describe('LiveStreamLayoutComponent other feeds', () => {
    let fixture: ComponentFixture<LiveStreamLayoutComponent>;
    let component: LiveStreamLayoutComponent;
    const selectedCategoryId = signal<number | null>(10);
    const xtreamStore = {
        getCategoriesBySelectedType: signal(categories),
        getDisplayedCategoriesBySelectedType: signal(categories),
        liveCategories: signal(categories),
        // The listed categories' items; the store leaves hidden ones in.
        getDisplayedContentByType: signal(() => liveStreams),
        getCategoryItemCounts: signal(new Map<number, number>()),
        getPaginatedContent: signal<unknown[]>([]),
        hasMoreContent: signal(false),
        epgItems: signal([]),
        currentEpgItem: signal(null),
        isLoadingEpg: signal(false),
        selectedTypeContentLoading: signal(false),
        selectedCategoryId,
        selectedContentType: signal('live'),
        selectedItem: signal<unknown>(null),
        currentPlaylist: signal(playlist),
        liveStreams: signal(liveStreams),
        isContentInitialized: signal(true),
        selectItemsFromSelectedCategory: jest.fn(() => [espn, espn2, espnPlus]),
        constructStreamUrl: jest.fn(
            (item: XtreamLiveChannelItem) =>
                `https://example.com/live/${item.xtream_id}.ts`
        ),
        openPlayer: jest.fn(),
        setSelectedItem: jest.fn(),
        setSelectedCategory: jest.fn((id: number | null) =>
            selectedCategoryId.set(id)
        ),
        loadMoreContent: jest.fn(),
    };

    beforeEach(async () => {
        selectedCategoryId.set(10);
        xtreamStore.constructStreamUrl.mockClear();
        xtreamStore.setSelectedCategory.mockClear();

        await TestBed.configureTestingModule({
            imports: [LiveStreamLayoutComponent, NoopAnimationsModule],
            providers: [
                {
                    provide: EpgArchiveDownloadService,
                    useValue: { start: jest.fn() },
                },
                {
                    provide: EpgArchiveCopyService,
                    useValue: { copy: jest.fn() },
                },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            data: {},
                            queryParamMap: convertToParamMap({}),
                        },
                        queryParamMap: of(convertToParamMap({})),
                    },
                },
                {
                    provide: Router,
                    useValue: {
                        events: new Subject().asObservable(),
                        navigate: jest.fn(),
                    },
                },
                { provide: XtreamStore, useValue: xtreamStore },
                {
                    provide: FavoritesService,
                    useValue: { getFavorites: jest.fn(() => of([])) },
                },
                {
                    provide: XtreamUrlService,
                    useValue: { constructAutoLiveTsUrl: jest.fn() },
                },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsXtreamSqliteDataSource: false },
                },
                {
                    provide: DatabaseService,
                    useValue: { getAllXtreamCategories: jest.fn() },
                },
                {
                    provide: SettingsStore,
                    useValue: {
                        openStreamOnDoubleClick: signal(false),
                        resolvedEpgViewMode: signal('timeline'),
                        resolvedEpgOffsetMinutes: signal(0),
                    },
                },
                {
                    provide: PORTAL_PLAYER,
                    useValue: {
                        isEmbeddedPlayer: () => true,
                        openExternalPlayback: jest.fn(),
                    },
                },
                {
                    provide: ParentalLockService,
                    useValue: {
                        version: signal(0),
                        active: signal(false),
                        isXtreamCategoryLocked: jest.fn(() => false),
                    },
                },
            ],
        })
            .overrideComponent(LiveStreamLayoutComponent, {
                remove: {
                    imports: [
                        EpgListViewComponent,
                        EpgTimelineComponent,
                        GridListComponent,
                        PortalChannelsListComponent,
                        TranslatePipe,
                        WebPlayerViewComponent,
                    ],
                },
                add: {
                    imports: [
                        StubEpgTimelineComponent,
                        StubGridListComponent,
                        StubPortalChannelsListComponent,
                        translate,
                        StubWebPlayerViewComponent,
                    ],
                },
            })
            .overrideComponent(ChannelFeedStripComponent, {
                remove: { imports: [TranslatePipe] },
                add: { imports: [translate] },
            })
            .compileComponents();

        fixture = TestBed.createComponent(LiveStreamLayoutComponent);
        component = fixture.componentInstance;
        TestBed.inject(LiveLayoutSidebarStateService).setState(
            'portal',
            'expanded'
        );
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    const host = (): HTMLElement => fixture.nativeElement;
    const strip = () => host().querySelector('app-channel-feed-strip');
    const feedButton = (id: number) =>
        host().querySelector<HTMLButtonElement>(
            `[data-test-id="channel-feed-${id}"]`
        );

    it("lists the playing ESPN's other feeds under the player", () => {
        component.playLive(espn2);
        fixture.detectChanges();

        expect(strip()?.textContent).toContain('"name":"ESPN"');
        expect(feedButton(2)?.getAttribute('aria-current')).toBe('true');
        expect(feedButton(1)).not.toBeNull();
        expect(feedButton(3)).not.toBeNull();
        // Outside the player, so a failed start's diagnostic never covers it.
        expect(
            host().querySelector('.video-player app-channel-feed-strip')
        ).toBeNull();
        expect(strip()?.parentElement?.classList).toContain(
            'content-container'
        );
    });

    it('offers no channel from a hidden category', () => {
        component.playLive(espn2);
        fixture.detectChanges();
        host()
            .querySelector<HTMLButtonElement>(
                '[data-test-id="channel-feeds-region-US"]'
            )
            ?.click();
        fixture.detectChanges();

        expect(feedButton(4)).not.toBeNull();
        expect(feedButton(5)).toBeNull();
    });

    it('switches to a chosen feed through the normal selection path', () => {
        component.playLive(espn2);
        fixture.detectChanges();
        xtreamStore.constructStreamUrl.mockClear();
        xtreamStore.setSelectedCategory.mockClear();

        feedButton(3)?.click();
        fixture.detectChanges();

        expect(xtreamStore.constructStreamUrl).toHaveBeenCalledWith(espnPlus);
        expect(xtreamStore.setSelectedCategory).toHaveBeenCalledWith(10);
        expect(component.activePlayback()?.streamUrl).toBe(
            'https://example.com/live/3.ts'
        );
        expect(component.channelNavigation.activeItem()).toBe(espnPlus);
        expect(feedButton(3)?.getAttribute('aria-current')).toBe('true');
    });

    it("selects another country's feed with its category", () => {
        component.playLive(espn2);
        fixture.detectChanges();
        host()
            .querySelector<HTMLButtonElement>(
                '[data-test-id="channel-feeds-region-US"]'
            )
            ?.click();
        fixture.detectChanges();

        feedButton(4)?.click();
        fixture.detectChanges();

        expect(xtreamStore.setSelectedCategory).toHaveBeenLastCalledWith(20);
        expect(component.activePlayback()?.streamUrl).toBe(
            'https://example.com/live/4.ts'
        );
    });

    it('shows nothing for a channel without other feeds', () => {
        component.playLive(teledeporte);
        fixture.detectChanges();

        expect(component.activePlayback()).not.toBeNull();
        expect(strip()).toBeNull();
    });
});
