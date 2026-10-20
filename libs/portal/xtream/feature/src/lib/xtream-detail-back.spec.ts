import { TestBed } from '@angular/core/testing';
import {
    WorkspaceBackNavigationService,
    type WorkspaceBackParent,
} from '@iptvnator/portal/shared/data-access';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';
import { SerialDetailsComponent } from './serial-details/serial-details.component';
import {
    configureSerialDetailsTestBed,
    createSerialDetailsStubs,
    resetSerialDetailsStubs,
} from './serial-details/serial-details.harness';
import { VodDetailsRouteComponent } from './vod-details/vod-details-route.component';
import {
    configureVodDetailsRouteTestBed,
    createVodDetailsRouteStubs,
    resetVodDetailsRouteStubs,
    silenceRouteLogging,
} from './vod-details/vod-details-route.harness';
import {
    injectXtreamDetailBack,
    XTREAM_INLINE_DETAIL_CLOSE,
} from './xtream-detail-back';

const PLAYING: ResolvedPortalPlayback = {
    streamUrl: 'http://xtream.example/movie/u/p/1.mp4',
    title: 'Playing',
    isLive: false,
};

function backNavigationStub() {
    return {
        back: jest.fn<void, [() => WorkspaceBackParent]>(),
        register: jest.fn(() => () => undefined),
    };
}

describe('injectXtreamDetailBack', () => {
    it.each([
        ['movie', '/workspace/movies'],
        ['series', '/workspace/series'],
    ] as const)(
        'a %s page steps history Back, else opens %s instead of leaving the app',
        (kind, parent) => {
            const backNavigation = backNavigationStub();
            TestBed.configureTestingModule({
                providers: [
                    {
                        provide: WorkspaceBackNavigationService,
                        useValue: backNavigation,
                    },
                ],
            });

            TestBed.runInInjectionContext(() => injectXtreamDetailBack(kind))();

            expect(backNavigation.back).toHaveBeenCalledTimes(1);
            expect(backNavigation.back.mock.calls[0][0]()).toBe(parent);
        }
    );

    it("closes a collection's inline detail rather than leaving its route", () => {
        const backNavigation = backNavigationStub();
        const close = jest.fn();
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: WorkspaceBackNavigationService,
                    useValue: backNavigation,
                },
                { provide: XTREAM_INLINE_DETAIL_CLOSE, useValue: close },
            ],
        });

        TestBed.runInInjectionContext(() => injectXtreamDetailBack('movie'))();

        expect(close).toHaveBeenCalledTimes(1);
        expect(backNavigation.back).not.toHaveBeenCalled();
    });
});

describe('a playing title page on Back', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('keeps the movie playing, so the navigation hands it to the mini-player', async () => {
        const restoreLogging = silenceRouteLogging();
        const stubs = createVodDetailsRouteStubs();
        resetVodDetailsRouteStubs(stubs);
        await configureVodDetailsRouteTestBed(stubs);
        const backNavigation = backNavigationStub();
        TestBed.overrideProvider(WorkspaceBackNavigationService, {
            useValue: backNavigation,
        });
        const page =
            TestBed.createComponent(VodDetailsRouteComponent).componentInstance;
        page.inlinePlayback.set(PLAYING);

        page.goBack();

        expect(page.inlinePlayback()).toBe(PLAYING);
        expect(backNavigation.back).toHaveBeenCalledTimes(1);
        expect(stubs.locationBack).not.toHaveBeenCalled();
        restoreLogging();
    });

    it('keeps the episode playing, so the navigation hands it to the mini-player', async () => {
        const stubs = createSerialDetailsStubs();
        resetSerialDetailsStubs(stubs);
        await configureSerialDetailsTestBed(stubs);
        const backNavigation = backNavigationStub();
        TestBed.overrideProvider(WorkspaceBackNavigationService, {
            useValue: backNavigation,
        });
        const page =
            TestBed.createComponent(SerialDetailsComponent).componentInstance;
        page.inlinePlayback.set(PLAYING);

        page.goBack();

        expect(page.inlinePlayback()).toBe(PLAYING);
        expect(backNavigation.back).toHaveBeenCalledTimes(1);
    });
});
