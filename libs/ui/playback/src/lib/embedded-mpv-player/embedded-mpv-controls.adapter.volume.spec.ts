import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type {
    EmbeddedMpvSession,
    EmbeddedMpvSupport,
    ResolvedPortalPlayback,
} from '@iptvnator/shared/interfaces';
import { TranslateModule } from '@ngx-translate/core';
import { EmbeddedMpvControlsAdapter } from './embedded-mpv-controls.adapter';
import { EmbeddedMpvSessionController } from './embedded-mpv-session-controller';
import { EMBEDDED_MPV_VOLUME_HOLD_MS } from './embedded-mpv-volume-request';

const EPISODE: ResolvedPortalPlayback = {
    streamUrl: 'https://example.com/series/episode.mkv',
    title: 'Episode',
    contentInfo: {
        contentXtreamId: 7,
        contentType: 'episode',
        playlistId: 'playlist-1',
    },
};

const FRAME_COPY: EmbeddedMpvSupport = {
    supported: true,
    platform: 'darwin',
    engine: 'frame-copy',
    capabilities: {
        subtitles: true,
        playbackSpeed: true,
        aspectOverride: true,
        screenshot: false,
        recording: true,
    },
};

function session(
    volume: number,
    overrides: Partial<EmbeddedMpvSession> = {}
): EmbeddedMpvSession {
    return {
        id: 'session-1',
        title: 'Episode',
        streamUrl: EPISODE.streamUrl,
        status: 'playing',
        positionSeconds: 4,
        durationSeconds: 2700,
        volume,
        audioTracks: [],
        selectedAudioTrackId: null,
        subtitleTracks: [],
        selectedSubtitleTrackId: null,
        playbackSpeed: 1,
        aspectOverride: 'no',
        recording: { active: false },
        startedAt: '2026-10-25T10:00:00.000Z',
        updatedAt: '2026-10-25T10:00:04.000Z',
        ...overrides,
    };
}

/**
 * Embedded MPV confirms a volume late (the frame-copy helper reports its
 * state at most every 250 ms, the main process polls every 500 ms) and a
 * command's reply carries the level from before it: the controls must keep
 * showing the level they asked for instead of snapping back.
 */
describe('EmbeddedMpvControlsAdapter volume', () => {
    let adapter: EmbeddedMpvControlsAdapter;
    let current: ReturnType<typeof signal<EmbeddedMpvSession | null>>;
    let applyVolume: jest.Mock<Promise<void>, [number]>;

    beforeEach(() => {
        jest.useFakeTimers();
        current = signal<EmbeddedMpvSession | null>(session(0.8));
        applyVolume = jest.fn().mockResolvedValue(undefined);
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                EmbeddedMpvControlsAdapter,
                {
                    provide: EmbeddedMpvSessionController,
                    useValue: {
                        support: signal(FRAME_COPY),
                        session: current,
                        stalled: signal(false),
                        applyVolume,
                    },
                },
            ],
        });
        adapter = TestBed.inject(EmbeddedMpvControlsAdapter);
        adapter.configure({
            playback: signal(EPISODE),
            seriesNavigation: signal(null),
            recordingFolder: signal(''),
        });
    });

    afterEach(() => {
        TestBed.resetTestingModule();
        jest.useRealTimers();
    });

    /** A session update from the main process (reply or broadcast). */
    function report(volume: number, id = 'session-1'): void {
        current.set(session(volume, { id }));
        TestBed.tick();
    }

    it('keeps a mute while the reply still reports the old level', () => {
        adapter.commands.setVolume(0);
        report(0.8);

        expect(applyVolume).toHaveBeenCalledWith(0);
        expect(adapter.state().volume).toBe(0);
    });

    it('never shows the player muted while it plays after an unmute', () => {
        adapter.commands.setVolume(0);
        report(0);
        adapter.commands.setVolume(0.8);
        // The mute's report reaches the controls after the unmute.
        report(0);

        expect(applyVolume).toHaveBeenLastCalledWith(0.8);
        expect(adapter.state().volume).toBe(0.8);
    });

    it('keeps the dragged level while late reports trail behind it', () => {
        for (const level of [0.7, 0.55, 0.4, 0.3]) {
            adapter.commands.setVolume(level);
        }
        report(0.8);
        expect(adapter.state().volume).toBe(0.3);

        report(0.55);
        expect(adapter.state().volume).toBe(0.3);

        report(0.3);
        expect(adapter.state().volume).toBe(0.3);
    });

    it('follows the session again once it reported the level asked for', () => {
        adapter.commands.setVolume(0);
        report(0);

        // A later change from elsewhere (the En vivo stage's slider).
        report(0.45);
        expect(adapter.state().volume).toBe(0.45);
    });

    it('gives way to the session when it never reports the level', () => {
        adapter.commands.setVolume(0.2);
        report(0.8);
        expect(adapter.state().volume).toBe(0.2);

        jest.advanceTimersByTime(EMBEDDED_MPV_VOLUME_HOLD_MS);
        TestBed.tick();

        expect(adapter.state().volume).toBe(0.8);
    });

    it("ignores a level asked of another session (the next episode's)", () => {
        adapter.commands.setVolume(0.2);
        report(0.8, 'session-2');

        expect(adapter.state().volume).toBe(0.8);
    });
});
