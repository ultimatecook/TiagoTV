import { signal } from '@angular/core';
import type { EmbeddedMpvSessionStatus } from '@iptvnator/shared/interfaces';
import { EmbeddedMpvCanvasPictureInPicture } from './embedded-mpv-canvas-pip';

type CaptureCanvas = HTMLCanvasElement & {
    captureStream?: (frameRate?: number) => MediaStream;
};

describe('EmbeddedMpvCanvasPictureInPicture', () => {
    let canvas: HTMLCanvasElement;
    let host: HTMLElement;
    let pipElement: Element | null;
    let stopTrack: jest.Mock;
    let request: jest.Mock;
    let exit: jest.Mock;
    const status = signal<EmbeddedMpvSessionStatus | undefined>('playing');
    const frameCopy = signal(true);
    const togglePaused = jest.fn();
    const originals = {
        capture: (HTMLCanvasElement.prototype as CaptureCanvas).captureStream,
        play: HTMLMediaElement.prototype.play,
    };

    beforeEach(() => {
        pipElement = null;
        stopTrack = jest.fn();
        status.set('playing');
        frameCopy.set(true);
        togglePaused.mockReset();
        host = document.createElement('div');
        canvas = document.createElement('canvas');
        host.appendChild(canvas);
        document.body.appendChild(host);
        (HTMLCanvasElement.prototype as CaptureCanvas).captureStream = jest.fn(
            () =>
                ({
                    getTracks: () => [{ stop: stopTrack }],
                }) as unknown as MediaStream
        );
        HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
        const enter = (video: HTMLVideoElement) => {
            pipElement = video;
            video.dispatchEvent(new Event('enterpictureinpicture'));
            return {} as PictureInPictureWindow;
        };
        request = jest.fn(async function (this: HTMLVideoElement) {
            return enter(this);
        });
        Object.defineProperty(
            HTMLVideoElement.prototype,
            'requestPictureInPicture',
            {
                configurable: true,
                value: request,
            }
        );
        exit = jest.fn(async () => {
            const element = pipElement;
            pipElement = null;
            element?.dispatchEvent(new Event('leavepictureinpicture'));
        });
        Object.defineProperty(document, 'pictureInPictureEnabled', {
            configurable: true,
            get: () => true,
        });
        Object.defineProperty(document, 'pictureInPictureElement', {
            configurable: true,
            get: () => pipElement,
        });
        Object.defineProperty(document, 'exitPictureInPicture', {
            configurable: true,
            value: exit,
        });
    });

    afterEach(() => {
        host.remove();
        (HTMLCanvasElement.prototype as CaptureCanvas).captureStream =
            originals.capture;
        HTMLMediaElement.prototype.play = originals.play;
        delete (
            HTMLVideoElement.prototype as { requestPictureInPicture?: unknown }
        ).requestPictureInPicture;
        delete (document as { pictureInPictureEnabled?: unknown })
            .pictureInPictureEnabled;
        delete (document as { pictureInPictureElement?: unknown })
            .pictureInPictureElement;
        delete (document as { exitPictureInPicture?: unknown })
            .exitPictureInPicture;
    });

    function create(): EmbeddedMpvCanvasPictureInPicture {
        return new EmbeddedMpvCanvasPictureInPicture({
            canvas: () => canvas,
            frameCopy,
            status,
            togglePaused,
        });
    }

    async function enter(pip: EmbeddedMpvCanvasPictureInPicture) {
        pip.toggle();
        await new Promise((resolve) => setTimeout(resolve));
        const video = host.querySelector<HTMLVideoElement>(
            'video[data-embedded-mpv-pip]'
        );
        expect(video).not.toBeNull();
        video?.dispatchEvent(new Event('loadedmetadata'));
        await new Promise((resolve) => setTimeout(resolve));
        return video as HTMLVideoElement;
    }

    it('is offered on the frame-copy engine only, with a picture to copy', () => {
        const pip = create();
        expect(pip.available()).toBe(true);
        expect(pip.ready()).toBe(true);

        status.set('loading');
        expect(pip.ready()).toBe(false);

        status.set('paused');
        frameCopy.set(false);
        expect(pip.available()).toBe(false);
        expect(pip.ready()).toBe(false);
    });

    it('plays the canvas in the PiP window through a hidden copy of it', async () => {
        const pip = create();
        const video = await enter(pip);

        expect((canvas as CaptureCanvas).captureStream).toHaveBeenCalledWith(
            30
        );
        expect(video.muted).toBe(true);
        expect(request).toHaveBeenCalledTimes(1);
        expect(pip.active()).toBe(true);
        expect(pip.pending()).toBe(false);

        // The window's own pause and play drive the session.
        video.dispatchEvent(new Event('pause'));
        expect(togglePaused).toHaveBeenCalledTimes(1);
        status.set('paused');
        video.dispatchEvent(new Event('pause'));
        expect(togglePaused).toHaveBeenCalledTimes(1);
        video.dispatchEvent(new Event('play'));
        expect(togglePaused).toHaveBeenCalledTimes(2);

        pip.toggle();
        await new Promise((resolve) => setTimeout(resolve));
        expect(exit).toHaveBeenCalledTimes(1);
        expect(pip.active()).toBe(false);
        expect(stopTrack).toHaveBeenCalled();
        expect(host.querySelector('video')).toBeNull();
    });

    it('closes the window and stops the copy with the player', async () => {
        const pip = create();
        await enter(pip);

        pip.destroy();
        await new Promise((resolve) => setTimeout(resolve));
        expect(exit).toHaveBeenCalledTimes(1);
        expect(stopTrack).toHaveBeenCalled();
        expect(pip.active()).toBe(false);
        expect(host.querySelector('video')).toBeNull();
    });
});
