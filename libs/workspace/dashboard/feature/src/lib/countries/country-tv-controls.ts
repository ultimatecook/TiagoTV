import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Keeps the player's own keyboard shortcuts off inside the page. */
export const SHORTCUTS_SUSPENDED = 'data-player-shortcuts-suspended';
const MEDIA_EVENTS = [
    'loadstart',
    'play',
    'playing',
    'pause',
    'emptied',
    'ended',
    'error',
    'volumechange',
] as const;
const STOPPED = new Set(['pause', 'emptied', 'ended', 'error', 'loadstart']);

/**
 * "En vivo"'s own controls over the player: the overlay's pause, volume
 * and full screen, and Space/K, M and F. The player's controls bar is
 * hidden there and its shortcuts suspended (`SHORTCUTS_SUSPENDED` on the
 * stage), so the page drives it the way its keys would: play/pause and
 * mute go to the player's controller as its own K and M, else straight to
 * its video. Full screen takes the whole stage, overlay included.
 *
 * The state comes from the player's `<video>` (HTML5, Video.js,
 * ArtPlayer); Embedded MPV has none, and there the page keeps its own.
 *
 * Component-provided: it lives as long as the page.
 */
@Injectable()
export class CountryTvControls {
    /** Pause or play shows on the button. */
    readonly paused = signal(false);
    /** The picture is moving (a video said `playing` since it last stopped). */
    readonly playing = signal(false);
    readonly muted = signal(false);
    readonly fullscreen = signal(false);

    private stage: HTMLElement | null = null;
    private video: HTMLVideoElement | null = null;
    private mpv = false;
    private readonly forwarded = new WeakSet<Event>();
    private observer: MutationObserver | null = null;
    private readonly onMedia = (event: Event) => this.read(event.type);
    private readonly onFullscreen = () =>
        this.fullscreen.set(
            !!this.stage && document.fullscreenElement === this.stage
        );

    constructor() {
        inject(DestroyRef).onDestroy(() => this.detach());
    }

    /** `stage`: the element around the player that goes full screen. */
    attach(stage: HTMLElement): void {
        this.detach();
        this.stage = stage;
        stage.setAttribute(SHORTCUTS_SUSPENDED, '');
        document.addEventListener('fullscreenchange', this.onFullscreen);
        if (typeof MutationObserver !== 'undefined') {
            this.observer = new MutationObserver(() => this.bind());
            this.observer.observe(stage, { childList: true, subtree: true });
        }
        this.bind();
    }

    /** A key this sent to the player: not the page's to handle again. */
    isForwarded(event: Event): boolean {
        return this.forwarded.has(event);
    }

    togglePlay(): void {
        const video = this.video;
        if (this.forward('k')) {
            if (!video) {
                this.paused.update((paused) => !paused);
                this.playing.set(!this.paused());
            }
        } else if (video?.paused) {
            void video.play().catch(() => undefined);
        } else {
            video?.pause();
        }
    }

    toggleMute(): void {
        const video = this.video;
        if (this.forward('m')) {
            if (!video) {
                this.muted.update((muted) => !muted);
            }
        } else if (video) {
            video.muted = !video.muted;
        }
    }

    toggleFullscreen(): void {
        const stage = this.stage;
        if (!stage) {
            return;
        }
        if (document.fullscreenElement) {
            void document.exitFullscreen?.()?.catch(() => undefined);
        } else {
            void stage.requestFullscreen?.()?.catch(() => undefined);
        }
    }

    /** The player's engine mounted, or remounted (a zap, a retry). */
    private bind(): void {
        const stage = this.stage;
        const video = stage?.querySelector('video') ?? null;
        const mpv = !video && !!stage?.querySelector('app-embedded-mpv-player');
        if (video === this.video && mpv === this.mpv) {
            return;
        }
        this.unbindVideo();
        this.video = video;
        this.mpv = mpv;
        for (const type of MEDIA_EVENTS) {
            video?.addEventListener(type, this.onMedia);
        }
        if (video) {
            this.read('bind');
        } else {
            // Embedded MPV draws without a <video>: it plays once mounted.
            this.paused.set(false);
            this.playing.set(mpv);
            this.muted.set(false);
        }
    }

    private read(type: string): void {
        const video = this.video;
        if (!video) {
            return;
        }
        if (type === 'playing') {
            this.playing.set(true);
        } else if (type === 'bind' || STOPPED.has(type)) {
            this.playing.set(false);
        }
        this.paused.set(video.paused);
        this.muted.set(video.muted || video.volume === 0);
    }

    /**
     * The key to the player's own shortcuts, as if they were not
     * suspended: whether its controller took it.
     */
    private forward(key: string): boolean {
        const stage = this.stage;
        if (!stage) {
            return false;
        }
        const event = new KeyboardEvent('keydown', {
            key,
            bubbles: true,
            cancelable: true,
        });
        this.forwarded.add(event);
        stage.removeAttribute(SHORTCUTS_SUSPENDED);
        try {
            document.dispatchEvent(event);
        } finally {
            stage.setAttribute(SHORTCUTS_SUSPENDED, '');
        }
        return event.defaultPrevented;
    }

    private unbindVideo(): void {
        for (const type of MEDIA_EVENTS) {
            this.video?.removeEventListener(type, this.onMedia);
        }
        this.video = null;
    }

    private detach(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.unbindVideo();
        if (typeof document !== 'undefined') {
            document.removeEventListener('fullscreenchange', this.onFullscreen);
        }
        this.stage = null;
    }
}
