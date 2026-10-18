import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    Injector,
    OnDestroy,
    OnInit,
    computed,
    effect,
    inject,
    input,
    signal,
    viewChild,
    type AfterViewInit,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PORTAL_PLAYBACK_POSITIONS } from '@iptvnator/portal/shared/util';
import { VideoPlayer } from '@iptvnator/shared/interfaces';
import { formatTime } from '../player-controls/controls-format.utils';
import { WebPlayerViewComponent } from '../web-player-view/web-player-view.component';
import {
    NowPlayingDockService,
    type NowPlayingSession,
} from './now-playing-dock.service';
import { NowPlayingVideo } from './now-playing-video';

/** Seconds a skip button moves the playback. */
const SKIP_SECONDS = 10;
/** How far playback moves before its resume position is saved again. */
const POSITION_SAVE_INTERVAL_SECONDS = 10;

/**
 * The bottom "now playing" pill. It continues the stream a page handed over
 * (`NowPlayingDockService`) in a small video where the artwork sits, with
 * close, skip, play/pause, repeat, time and volume, and saves the resume
 * position like the page did. The artwork and title lead back to the page.
 */
@Component({
    selector: 'app-now-playing-bar',
    imports: [MatIcon, MatTooltip, TranslatePipe, WebPlayerViewComponent],
    templateUrl: './now-playing-bar.component.html',
    styleUrl: './now-playing-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NowPlayingBarComponent
    implements OnInit, AfterViewInit, OnDestroy
{
    private readonly dock = inject(NowPlayingDockService);
    private readonly router = inject(Router);
    private readonly injector = inject(Injector);
    private readonly positions = inject(PORTAL_PLAYBACK_POSITIONS, {
        optional: true,
    });
    private readonly videoHost =
        viewChild.required<ElementRef<HTMLElement>>('videoHost');
    private lastSavedPosition = 0;

    readonly session = input.required<NowPlayingSession>();
    /** The mini-player always plays in the built-in HTML5 engine. */
    readonly html5Player = VideoPlayer.Html5Player;
    readonly failed = signal(false);
    protected video!: NowPlayingVideo;

    readonly showVideo = computed(
        () => this.video.attached() && !this.failed()
    );
    readonly progressPercent = computed(() => {
        const duration = this.video.duration();
        return duration > 0
            ? Math.min(100, (this.video.currentTime() / duration) * 100)
            : 0;
    });
    readonly timeLabel = computed(() => {
        const session = this.session();
        const current = this.video.attached()
            ? this.video.currentTime()
            : session.startTime;
        const duration = this.video.duration() || session.duration;
        return duration > 0
            ? `${formatTime(current)} / ${formatTime(duration)}`
            : formatTime(current);
    });
    readonly volumeIcon = computed(() => {
        if (this.video.muted() || this.video.volume() === 0) {
            return 'volume_off';
        }
        return this.video.volume() < 0.5 ? 'volume_down' : 'volume_up';
    });

    ngOnInit(): void {
        const session = this.session();
        this.video = new NowPlayingVideo({
            startTime: session.isLive ? 0 : session.startTime,
            startPaused: session.paused,
            volume: session.volume,
            muted: session.muted,
        });
        effect(
            () => {
                this.video.currentTime();
                this.saveResumePosition(false);
            },
            { injector: this.injector }
        );
    }

    ngAfterViewInit(): void {
        this.video.observe(this.videoHost().nativeElement);
    }

    ngOnDestroy(): void {
        this.saveResumePosition(true);
        this.video.destroy();
    }

    togglePaused(): void {
        this.video.togglePaused();
    }

    skipBack(): void {
        this.video.seekBy(-SKIP_SECONDS);
    }

    skipForward(): void {
        this.video.seekBy(SKIP_SECONDS);
    }

    toggleRepeat(): void {
        this.video.toggleLoop();
    }

    toggleMuted(): void {
        this.video.toggleMuted();
    }

    onVolumeInput(event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.video.setVolume(value / 100);
    }

    onSeekInput(event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.video.seekTo((value / 1000) * this.video.duration());
    }

    onPlaybackFailed(): void {
        this.failed.set(true);
    }

    close(): void {
        this.dock.close();
    }

    /** Back to the page the playback came from; the bar keeps playing. */
    openSource(): void {
        const session = this.session();
        if (!session.returnUrl) {
            return;
        }
        void this.router.navigateByUrl(session.returnUrl, {
            state: session.returnState ?? undefined,
        });
    }

    /**
     * Keeps "Continue watching" and the detail pages' resume in step with
     * the mini-player: every few seconds of progress, and once at the end.
     */
    private saveResumePosition(force: boolean): void {
        const session = this.session();
        const info = session.playback?.contentInfo;
        const position = this.video.currentTime();
        if (!info || session.isLive || !this.positions || !(position > 0)) {
            return;
        }
        if (
            !force &&
            Math.abs(position - this.lastSavedPosition) <
                POSITION_SAVE_INTERVAL_SECONDS
        ) {
            return;
        }
        this.lastSavedPosition = position;
        const duration = this.video.duration();
        void this.positions
            .savePlaybackPosition(info.playlistId, {
                ...info,
                positionSeconds: Math.floor(position),
                ...(duration > 0
                    ? { durationSeconds: Math.floor(duration) }
                    : {}),
            })
            .catch(() => undefined);
    }
}
