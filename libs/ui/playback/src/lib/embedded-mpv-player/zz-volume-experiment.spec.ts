// SCRATCH EXPERIMENT (to be deleted): frame-copy Embedded MPV + shared
// controls, with a fake bridge that answers like the main process does
// (stale snapshot in the reply; the helper's new level comes later in a
// broadcast).
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import type {
    EmbeddedMpvSession,
    ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { EmbeddedMpvOverlayVisibilityService } from './embedded-mpv-overlay-visibility.service';
import { EmbeddedMpvPlayerComponent } from './embedded-mpv-player.component';

const PLAYBACK: ResolvedPortalPlayback = {
    streamUrl: 'https://example.test/series/1.mkv',
    title: 'Episode',
    contentInfo: {
        playlistId: 'playlist-1',
        contentXtreamId: 42,
        contentType: 'episode',
    },
} as ResolvedPortalPlayback;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('EXPERIMENT frame-copy volume', () => {
    let helperVolume = 1;
    let listener: ((s: EmbeddedMpvSession) => void) | null = null;
    const calls: string[] = [];

    function snapshot(): EmbeddedMpvSession {
        return {
            id: 'fc-1',
            title: 'Episode',
            streamUrl: PLAYBACK.streamUrl,
            status: 'playing',
            positionSeconds: 4,
            durationSeconds: 3000,
            volume: helperVolume,
            audioTracks: [],
            selectedAudioTrackId: null,
            subtitleTracks: [],
            selectedSubtitleTrackId: null,
            playbackSpeed: 1,
            aspectOverride: 'no',
            recording: { active: false },
            startedAt: '2026-10-25T10:00:00Z',
            updatedAt: new Date().toISOString(),
        };
    }
    const broadcast = () => listener?.(snapshot());

    beforeEach(async () => {
        localStorage.setItem('volume', process.env['STORED'] ?? '0.8');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            value: {
                platform: 'darwin',
                getEmbeddedMpvSupport: jest.fn().mockResolvedValue({
                    supported: true,
                    platform: 'darwin',
                    engine: 'frame-copy',
                    capabilities: {
                        subtitles: true,
                        playbackSpeed: true,
                        aspectOverride: true,
                        screenshot: true,
                        recording: true,
                    },
                }),
                prepareEmbeddedMpv: jest
                    .fn()
                    .mockResolvedValue({ supported: true, platform: 'darwin' }),
                createEmbeddedMpvSession: jest.fn(
                    async (_b: unknown, _t: unknown, initial: number) => {
                        calls.push(`create(${initial})`);
                        setTimeout(() => {
                            helperVolume = initial;
                            broadcast();
                        }, 40);
                        return { ...snapshot(), volume: 1 };
                    }
                ),
                loadEmbeddedMpvPlayback: jest.fn().mockResolvedValue(undefined),
                attachEmbeddedMpvFrameView: jest.fn().mockResolvedValue(true),
                detachEmbeddedMpvFrameView: jest.fn(),
                disposeEmbeddedMpvSession: jest.fn().mockResolvedValue(undefined),
                setEmbeddedMpvBounds: jest.fn().mockResolvedValue(undefined),
                onEmbeddedMpvSessionUpdate: jest.fn((cb) => {
                    listener = cb;
                    return () => undefined;
                }),
                setEmbeddedMpvVolume: jest.fn(async (_id: string, v: number) => {
                    calls.push(`setVolume(${v})`);
                    const reply = snapshot();
                    setTimeout(() => {
                        helperVolume = v;
                        broadcast();
                    }, 30);
                    return reply;
                }),
            },
        });
        Object.defineProperty(globalThis, 'ResizeObserver', {
            configurable: true,
            value: class {
                observe = jest.fn();
                disconnect = jest.fn();
            },
        });
        await TestBed.configureTestingModule({
            imports: [EmbeddedMpvPlayerComponent, TranslateModule.forRoot()],
            providers: [
                {
                    provide: EmbeddedMpvOverlayVisibilityService,
                    useValue: { overlayActive: signal(false) },
                },
            ],
        }).compileComponents();
    });

    it('mutes and adjusts', async () => {
        const fixture = TestBed.createComponent(EmbeddedMpvPlayerComponent);
        fixture.componentRef.setInput('playback', PLAYBACK);
        fixture.componentRef.setInput('showControls', true);
        fixture.autoDetectChanges(true);
        for (let i = 0; i < 20; i++) {
            await sleep(25);
            fixture.detectChanges();
        }
        const btn = () =>
            fixture.debugElement.query(
                By.css('.player-controls__volume button')
            )?.nativeElement as HTMLButtonElement | undefined;
        const slider = () =>
            fixture.debugElement.query(
                By.css('.player-controls__slider--volume')
            )?.nativeElement as HTMLInputElement | undefined;
        const report = (label: string) =>
            // eslint-disable-next-line no-console
            console.log(
                label,
                JSON.stringify({
                    helperVolume,
                    slider: slider()?.value,
                    icon: btn()?.textContent?.trim(),
                    stored: localStorage.getItem('volume'),
                    calls: calls.splice(0),
                })
            );
        report('ready');
        btn()?.click();
        fixture.detectChanges();
        for (let i = 0; i < 10; i++) {
            await sleep(25);
            fixture.detectChanges();
        }
        report('after mute');
        btn()?.click();
        for (let i = 0; i < 10; i++) {
            await sleep(25);
            fixture.detectChanges();
        }
        report('after unmute');
        for (const v of [0.7, 0.6, 0.5, 0.4, 0.3]) {
            const el = slider();
            if (!el) break;
            el.value = String(v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            await sleep(8);
        }
        for (let i = 0; i < 10; i++) {
            await sleep(25);
            fixture.detectChanges();
        }
        report('after drag');
        fixture.destroy();
    });
});
