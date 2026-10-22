import { signal } from '@angular/core';

const MEDIA_EVENTS = [
    'play',
    'playing',
    'pause',
    'timeupdate',
    'durationchange',
    'loadedmetadata',
    'volumechange',
    'ended',
    'enterpictureinpicture',
    'leavepictureinpicture',
] as const;

/** `HTMLMediaElement.HAVE_METADATA`: PiP needs the picture's size. */
const HAVE_METADATA = 1;

/**
 * The mini-player's view of the media element its embedded web player
 * renders: state as signals, commands on the element itself. The element
 * appears asynchronously (engines mount deferred, sources load after IPC),
 * so the container is watched until one shows up — and again if the engine
 * replaces it.
 */
export class NowPlayingVideo {
    private video: HTMLVideoElement | null = null;
    private observer: MutationObserver | null = null;
    private pausePending = false;
    /** Seconds to resume at; cleared once the media has been moved there. */
    private pendingStart: number;
    private repeat = false;
    private readonly onMediaEvent = () => this.sync();

    readonly attached = signal(false);
    readonly paused = signal(true);
    readonly currentTime = signal(0);
    readonly duration = signal(0);
    readonly volume = signal(1);
    readonly muted = signal(false);
    readonly loop = signal(false);
    readonly ended = signal(false);
    /** The bar's picture is in picture-in-picture. */
    readonly pictureInPicture = signal(false);
    /** The browser offers PiP for it now (metadata in, API enabled). */
    readonly canPictureInPicture = signal(false);
    /** The page's picture was in PiP: ask once the bar's is ready. */
    private resumePictureInPicture: boolean;

    /**
     * @param startPaused the page had paused it: keep it paused here too,
     *   whatever the engine's autoplay does once the source loads.
     */
    constructor(
        private readonly options: {
            /** Where the page was; 0 starts at the beginning (and live). */
            readonly startTime: number;
            readonly startPaused: boolean;
            readonly volume: number;
            readonly muted: boolean;
            readonly pictureInPicture?: boolean;
        }
    ) {
        this.resumePictureInPicture = options.pictureInPicture === true;
        this.pendingStart = options.startTime > 0 ? options.startTime : 0;
        this.pausePending = options.startPaused;
        this.volume.set(options.volume);
        this.muted.set(options.muted);
    }

    observe(container: HTMLElement): void {
        this.adopt(container.querySelector('video'));
        if (typeof MutationObserver === 'undefined') {
            return;
        }
        this.observer = new MutationObserver(() => {
            const next = container.querySelector('video');
            if (next !== this.video) {
                this.adopt(next);
            }
        });
        this.observer.observe(container, { childList: true, subtree: true });
    }

    destroy(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.adopt(null);
    }

    togglePaused(): void {
        const video = this.video;
        if (!video) {
            this.pausePending = !this.pausePending;
            this.paused.set(this.pausePending);
            return;
        }
        if (video.paused || video.ended) {
            // The user asked to play: the handed-over pause is over.
            this.pausePending = false;
            void video.play()?.catch(() => undefined);
        } else {
            video.pause();
        }
    }

    seekBy(deltaSeconds: number): void {
        const video = this.video;
        if (!video) {
            return;
        }
        this.seekTo(video.currentTime + deltaSeconds);
    }

    seekTo(seconds: number): void {
        const video = this.video;
        const duration = this.duration();
        if (!video || !(duration > 0)) {
            return;
        }
        video.currentTime = Math.min(Math.max(seconds, 0), duration - 0.5);
    }

    setVolume(volume: number): void {
        const next = Math.min(Math.max(volume, 0), 1);
        const video = this.video;
        if (video) {
            video.volume = next;
            video.muted = next === 0;
        } else {
            this.volume.set(next);
            this.muted.set(next === 0);
        }
    }

    toggleMuted(): void {
        const video = this.video;
        if (!video) {
            this.muted.update((muted) => !muted);
            return;
        }
        if (video.muted || video.volume === 0) {
            video.muted = false;
            if (video.volume === 0) {
                video.volume = 0.5;
            }
        } else {
            video.muted = true;
        }
    }

    /**
     * The same picture in the system's floating window (no second stream):
     * called from the button's click, whose user activation PiP needs.
     */
    togglePictureInPicture(): void {
        const video = this.video;
        if (!video) {
            return;
        }
        const document = video.ownerDocument;
        if (document?.pictureInPictureElement === video) {
            void document.exitPictureInPicture?.()?.catch(() => undefined);
        } else if (this.canPictureInPicture()) {
            void video.requestPictureInPicture?.()?.catch(() => undefined);
        }
    }

    toggleLoop(): void {
        this.repeat = !this.repeat;
        if (this.video) {
            this.video.loop = this.repeat;
        }
        this.loop.set(this.repeat);
    }

    private adopt(video: HTMLVideoElement | null): void {
        if (this.video) {
            for (const type of MEDIA_EVENTS) {
                this.video.removeEventListener(type, this.onMediaEvent);
            }
        }
        this.video = video;
        this.attached.set(video !== null);
        if (!video) {
            return;
        }
        for (const type of MEDIA_EVENTS) {
            video.addEventListener(type, this.onMediaEvent);
        }
        video.loop = this.repeat;
        video.volume = this.volume();
        video.muted = this.muted();
        this.sync();
    }

    private sync(): void {
        const video = this.video;
        if (!video) {
            return;
        }
        // The engine may settle its own start position at 0 before the
        // metadata is in; the handed-over position is applied here, once.
        if (this.pendingStart > 0 && finite(video.duration) > 0) {
            const start = Math.min(this.pendingStart, video.duration - 1);
            this.pendingStart = 0;
            if (Math.abs(video.currentTime - start) > 1) {
                video.currentTime = start;
            }
        }
        if (this.pausePending && !video.paused) {
            // The engine autoplayed a stream the page had paused; it keeps
            // trying until the source is in, so this holds until the user
            // presses play.
            video.pause();
            return;
        }
        this.paused.set(video.paused);
        this.currentTime.set(finite(video.currentTime));
        this.duration.set(finite(video.duration));
        this.volume.set(video.volume);
        this.muted.set(video.muted);
        this.ended.set(video.ended);
        this.syncPictureInPicture(video);
    }

    private syncPictureInPicture(video: HTMLVideoElement): void {
        const document = video.ownerDocument;
        if (!document) {
            return;
        }
        this.pictureInPicture.set(document.pictureInPictureElement === video);
        const able =
            document.pictureInPictureEnabled === true &&
            typeof video.requestPictureInPicture === 'function' &&
            !video.disablePictureInPicture &&
            video.readyState >= HAVE_METADATA;
        this.canPictureInPicture.set(able);
        if (able && this.resumePictureInPicture) {
            // Once: refused without a recent user gesture, which is fine.
            this.resumePictureInPicture = false;
            if (document.pictureInPictureElement !== video) {
                void video.requestPictureInPicture().catch(() => undefined);
            }
        }
    }
}

function finite(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
}
