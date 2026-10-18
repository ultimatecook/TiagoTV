import { ClipboardModule } from '@angular/cdk/clipboard';
import {
    ComponentFixture,
    DeferBlockBehavior,
    TestBed,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { StorageMap } from '@ngx-pwa/local-storage';
import { TranslateModule } from '@ngx-translate/core';
import {
    PlaybackDiagnosticCode,
    PlaybackDiagnosticSource,
    type PlaybackDiagnostic,
} from '@iptvnator/playback/util';
import { RuntimeCapabilitiesService, SettingsStore } from '@iptvnator/services';
import {
    type ExternalPlayerSession,
    type ResolvedPortalPlayback,
    STORE_KEY,
    VideoPlayer,
} from '@iptvnator/shared/interfaces';
import { PORTAL_EXTERNAL_PLAYBACK } from '@iptvnator/portal/shared/util';
import { of } from 'rxjs';
import { NowPlayingDockService } from '../now-playing/now-playing-dock.service';
import { PlaybackDiagnosticPanelComponent } from '../playback-diagnostic-panel/playback-diagnostic-panel.component';
import {
    StubArtPlayerComponent,
    StubEmbeddedMpvPlayerComponent,
    StubFullscreenChannelPanelComponent,
    StubHtmlVideoPlayerComponent,
    StubVjsPlayerComponent,
} from './web-player-view.spec-stubs';
import { ElectronStreamHeadersService } from './electron-stream-headers.service';
import {
    LIVE_START_RETRY_DELAY_MS,
    LIVE_START_TIMEOUT_MS,
} from './web-player-live-start-guard';
import type { WebPlayerViewComponent as WebPlayerViewComponentInstance } from './web-player-view.component';

jest.unstable_mockModule('video.js', () => ({ default: jest.fn() }));
jest.unstable_mockModule('@yangkghjh/videojs-aspect-ratio-panel', () => ({}));
jest.unstable_mockModule('videojs-contrib-quality-levels', () => ({}));
jest.unstable_mockModule('videojs-quality-selector-hls', () => ({}));

const LIVE_TS: ResolvedPortalPlayback = {
    streamUrl: 'https://provider.test/live/u/p/101.ts',
    title: 'Live',
    isLive: true,
};

describe('WebPlayerViewComponent live start recovery', () => {
    let WebPlayerViewComponent: typeof import('./web-player-view.component').WebPlayerViewComponent;
    let fixture: ComponentFixture<WebPlayerViewComponentInstance>;
    let component: WebPlayerViewComponentInstance;
    let failures: PlaybackDiagnosticCode[];
    const storage = {
        get: jest.fn((key: string) =>
            of(
                key === STORE_KEY.Settings
                    ? { player: VideoPlayer.VideoJs }
                    : undefined
            )
        ),
    };

    beforeAll(async () => {
        ({ WebPlayerViewComponent } =
            await import('./web-player-view.component'));
    });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            deferBlockBehavior: DeferBlockBehavior.Playthrough,
            imports: [WebPlayerViewComponent, TranslateModule.forRoot()],
            providers: [
                { provide: StorageMap, useValue: storage },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: { supportsManagedExternalPlayers: false },
                },
                {
                    provide: ElectronStreamHeadersService,
                    useValue: { apply: () => null, clear: jest.fn() },
                },
                {
                    provide: SettingsStore,
                    useValue: {
                        showCaptions: () => false,
                        webPlayerSharedControls: () => false,
                    },
                },
                {
                    provide: PORTAL_EXTERNAL_PLAYBACK,
                    useValue: {
                        activeSession: signal<ExternalPlayerSession | null>(
                            null
                        ),
                        visibleSession: signal(null),
                        dismissActiveSession: jest.fn(),
                        closeSession: jest.fn(),
                    },
                },
            ],
        })
            .overrideComponent(WebPlayerViewComponent, {
                set: {
                    imports: [
                        ClipboardModule,
                        MatButtonModule,
                        MatIconModule,
                        MatTooltipModule,
                        PlaybackDiagnosticPanelComponent,
                        StubArtPlayerComponent,
                        StubEmbeddedMpvPlayerComponent,
                        StubFullscreenChannelPanelComponent,
                        StubHtmlVideoPlayerComponent,
                        StubVjsPlayerComponent,
                        TranslateModule,
                    ],
                },
            })
            .compileComponents();

        jest.useFakeTimers();
        fixture = TestBed.createComponent(WebPlayerViewComponent);
        component = fixture.componentInstance;
        failures = [];
        component.playbackFailed.subscribe((code) => failures.push(code));
        fixture.componentRef.setInput('streamUrl', LIVE_TS.streamUrl);
        fixture.componentRef.setInput('playbackSessionKey', 'rig/101');
        fixture.componentRef.setInput('playback', LIVE_TS);
    });

    afterEach(() => {
        fixture.destroy();
        jest.useRealTimers();
    });

    it('closes a refused live start, waits for the slot and reopens it', async () => {
        await settle();
        const first = engine();
        expect(first?.options()).toEqual(
            expect.objectContaining({ reloadToken: 0 })
        );

        refuse();
        await settle();

        // The engine is gone (its request aborted) for the whole pause.
        expect(engine()).toBeNull();
        expect(component.visiblePlaybackDiagnostic()).toBeNull();
        await settle(LIVE_START_RETRY_DELAY_MS - 1);
        expect(engine()).toBeNull();

        await settle(1);
        expect(engine()).not.toBe(first);
        expect(engine()?.options()).toEqual(
            expect.objectContaining({ reloadToken: 1 })
        );
        expect(failures).toEqual([]);
    });

    it('shows the refusal once the bounded reopenings are spent', async () => {
        await settle();
        refuse();
        await settle(LIVE_START_RETRY_DELAY_MS);
        refuse();
        await settle(LIVE_START_RETRY_DELAY_MS);
        refuse();
        await settle();

        expect(component.visiblePlaybackDiagnostic()?.httpStatus).toBe(403);
        expect(failures).toEqual([PlaybackDiagnosticCode.NetworkError]);
        expect(engine()?.options()).toEqual(
            expect.objectContaining({ reloadToken: 2 })
        );
    });

    it('reopens a live start that hangs and reports it when it never plays', async () => {
        await settle(LIVE_START_TIMEOUT_MS - 1);
        expect(engine()).not.toBeNull();
        await settle(1);
        expect(engine()).toBeNull();

        await settle(LIVE_START_RETRY_DELAY_MS);
        expect(engine()).not.toBeNull();
        await settle(LIVE_START_TIMEOUT_MS + LIVE_START_RETRY_DELAY_MS);
        expect(failures).toEqual([]);
        await settle(LIVE_START_TIMEOUT_MS);

        expect(component.visiblePlaybackDiagnostic()).toEqual(
            expect.objectContaining({
                code: PlaybackDiagnosticCode.NetworkError,
                details: 'start-timeout',
            })
        );
        expect(failures).toEqual([PlaybackDiagnosticCode.NetworkError]);
    });

    it('leaves a live stream that played, and VOD, to the diagnostic', async () => {
        await settle();
        engine()?.playbackStarted.emit();
        await settle(LIVE_START_TIMEOUT_MS * 3);
        expect(engine()?.options()).toEqual(
            expect.objectContaining({ reloadToken: 0 })
        );
        refuse();
        await settle();
        expect(component.visiblePlaybackDiagnostic()?.httpStatus).toBe(403);

        fixture.componentRef.setInput('playbackSessionKey', 'vod/7');
        fixture.componentRef.setInput('playback', {
            ...LIVE_TS,
            streamUrl: 'https://provider.test/movie/u/p/7.ts',
            isLive: false,
        });
        await settle();
        refuse();
        await settle();
        expect(component.visiblePlaybackDiagnostic()?.httpStatus).toBe(403);
    });

    it("opens nothing while the mini-player's player still holds the stream", async () => {
        const releaseBarPlayer = TestBed.inject(
            NowPlayingDockService
        ).registerPlayer();

        await settle();
        expect(engine()).toBeNull();

        releaseBarPlayer();
        await settle();
        expect(engine()).not.toBeNull();
    });

    function engine(): StubVjsPlayerComponent | null {
        return (
            (fixture.debugElement.query(By.directive(StubVjsPlayerComponent))
                ?.componentInstance as StubVjsPlayerComponent | undefined) ??
            null
        );
    }

    function refuse(): void {
        engine()?.playbackIssue.emit(refusal());
    }

    async function settle(ms = 0): Promise<void> {
        fixture.detectChanges();
        await jest.advanceTimersByTimeAsync(ms);
        fixture.detectChanges();
        await jest.advanceTimersByTimeAsync(0);
        fixture.detectChanges();
    }
});

function refusal(): PlaybackDiagnostic {
    return {
        code: PlaybackDiagnosticCode.NetworkError,
        source: PlaybackDiagnosticSource.MpegTs,
        sourceUrl: LIVE_TS.streamUrl,
        container: 'ts',
        player: 'videojs',
        audioCodecs: [],
        videoCodecs: [],
        httpStatus: 403,
    };
}
