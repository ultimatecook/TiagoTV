import { computed, signal } from '@angular/core';
import type { EmbeddedMpvSessionStatus } from '@iptvnator/shared/interfaces';

/** Frames per second the PiP window copies from the canvas. */
const PIP_FRAME_RATE = 30;
/** How long the copy may take to start before PiP is given up. */
const METADATA_WAIT_MS = 3000;

type CaptureCanvas = HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
};

/** This browser can copy a canvas into a PiP window at all. */
export function canvasPictureInPictureAvailable(): boolean {
    return (
        typeof document !== 'undefined' &&
        document.pictureInPictureEnabled === true &&
        typeof HTMLCanvasElement !== 'undefined' &&
        typeof (HTMLCanvasElement.prototype as CaptureCanvas).captureStream ===
            'function'
    );
}

export interface CanvasPictureInPictureDeps {
    /** The frame-copy engine's canvas; null with the native view. */
    readonly canvas: () => HTMLCanvasElement | null;
    /** The session renders on the frame-copy engine (a signal read). */
    readonly frameCopy: () => boolean;
    readonly status: () => EmbeddedMpvSessionStatus | undefined;
    /** The PiP window's own play/pause buttons drive the player. */
    readonly togglePaused: () => void;
}

/**
 * Picture-in-picture for Embedded MPV's frame-copy engine. Its picture is
 * an ordinary canvas the helper's frames are drawn on, so the canvas's own
 * stream (`captureStream`) plays in a hidden, muted `<video>` that enters
 * the browser's PiP window: the same session, no second stream (MPV keeps
 * the sound). The native-view engine paints a platform view no page
 * element can read, so it offers none (`supported()` is false).
 */
export class EmbeddedMpvCanvasPictureInPicture {
    /** The PiP window shows this player's picture. */
    readonly active = signal(false);
    /** An entry or exit is under way. */
    readonly pending = signal(false);
    /** The controls offer PiP: frame-copy, in a browser that can copy. */
    readonly available = computed(
        () => this.deps.frameCopy() && canvasPictureInPictureAvailable()
    );
    /** A picture is there to copy, and nothing is under way. */
    readonly ready = computed(() => {
        const status = this.deps.status();
        return (
            this.available() &&
            !this.pending() &&
            (status === 'playing' || status === 'paused')
        );
    });
    private video: HTMLVideoElement | null = null;
    private stream: MediaStream | null = null;
    private generation = 0;

    constructor(private readonly deps: CanvasPictureInPictureDeps) {}

    /** The canvas can be copied and the browser has PiP. */
    supported(): boolean {
        const canvas = this.deps.canvas() as CaptureCanvas | null;
        return (
            !!canvas &&
            typeof canvas.captureStream === 'function' &&
            canvas.ownerDocument.pictureInPictureEnabled === true
        );
    }

    /** Called from a click or the P key: their user activation lasts. */
    toggle(): void {
        if (this.pending()) {
            return;
        }
        const video = this.video;
        if (video && video.ownerDocument.pictureInPictureElement === video) {
            this.pending.set(true);
            void video.ownerDocument
                .exitPictureInPicture()
                .catch(() => undefined)
                .finally(() => this.pending.set(false));
            return;
        }
        void this.enter();
    }

    /** The player goes away: PiP closes and the copy stops. */
    destroy(): void {
        this.generation++;
        const video = this.video;
        if (video && video.ownerDocument.pictureInPictureElement === video) {
            void video.ownerDocument
                .exitPictureInPicture()
                .catch(() => undefined);
        }
        this.release();
    }

    private async enter(): Promise<void> {
        const canvas = this.deps.canvas() as CaptureCanvas | null;
        if (!canvas || !this.supported() || !canvas.captureStream) {
            return;
        }
        const generation = ++this.generation;
        this.pending.set(true);
        try {
            const video = this.ensureVideo(canvas, canvas.captureStream);
            await Promise.resolve()
                .then(() => video.play())
                .catch(() => undefined);
            await whenMetadata(video);
            if (generation !== this.generation) {
                return;
            }
            await video.requestPictureInPicture();
        } catch {
            if (generation === this.generation && !this.active()) {
                this.release();
            }
        } finally {
            if (generation === this.generation) {
                this.pending.set(false);
            }
        }
    }

    private ensureVideo(
        canvas: HTMLCanvasElement,
        capture: (frameRate?: number) => MediaStream
    ): HTMLVideoElement {
        if (this.video) {
            return this.video;
        }
        const document = canvas.ownerDocument;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('aria-hidden', 'true');
        video.dataset['embeddedMpvPip'] = '';
        Object.assign(video.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: '0',
            pointerEvents: 'none',
        });
        this.stream = capture.call(canvas, PIP_FRAME_RATE);
        video.srcObject = this.stream;
        video.addEventListener('enterpictureinpicture', () =>
            this.active.set(true)
        );
        video.addEventListener('leavepictureinpicture', () => {
            this.active.set(false);
            this.release();
        });
        // The PiP window's play/pause buttons act on this video.
        video.addEventListener('pause', () => this.follow(true));
        video.addEventListener('play', () => this.follow(false));
        canvas.parentElement?.appendChild(video);
        this.video = video;
        return video;
    }

    /** The PiP window's play/pause, applied to the session. */
    private follow(paused: boolean): void {
        if (this.active() && (this.deps.status() === 'paused') !== paused) {
            this.deps.togglePaused();
        }
    }

    private release(): void {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        const video = this.video;
        this.video = null;
        if (video) {
            video.srcObject = null;
            video.remove();
        }
        this.active.set(false);
    }
}

function whenMetadata(video: HTMLVideoElement): Promise<void> {
    if (video.readyState >= 1) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            video.removeEventListener('loadedmetadata', done);
            reject(new Error('PiP copy did not start'));
        }, METADATA_WAIT_MS);
        const done = () => {
            clearTimeout(timer);
            resolve();
        };
        video.addEventListener('loadedmetadata', done, { once: true });
    });
}
