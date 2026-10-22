import { NowPlayingVideo } from './now-playing-video';

/** Just enough of a media element for the mini-player's controller. */
class FakeVideo extends EventTarget {
    currentTime = 0;
    duration = NaN;
    paused = true;
    ended = false;
    volume = 1;
    muted = false;
    loop = false;
    seeks: number[] = [];

    play(): Promise<void> {
        this.paused = false;
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
    }

    pause(): void {
        this.paused = true;
        this.dispatchEvent(new Event('pause'));
    }

    loadMetadata(duration: number): void {
        this.duration = duration;
        this.dispatchEvent(new Event('loadedmetadata'));
    }
}

function mount(
    options: Partial<ConstructorParameters<typeof NowPlayingVideo>[0]> = {}
) {
    const fake = new FakeVideo();
    // Records every position assignment, so the spec sees the seeks.
    let time = 0;
    Object.defineProperty(fake, 'currentTime', {
        get: () => time,
        set: (value: number) => {
            time = value;
            fake.seeks.push(value);
        },
    });
    const container = document.createElement('div');
    container.querySelector = (() => fake) as never;
    const controller = new NowPlayingVideo({
        startTime: 0,
        startPaused: false,
        volume: 0.6,
        muted: false,
        ...options,
    });
    controller.observe(container);
    return { fake, controller };
}

describe('NowPlayingVideo', () => {
    it('resumes at the handed-over position once the metadata is in', () => {
        const { fake, controller } = mount({ startTime: 125 });

        expect(fake.seeks).toEqual([]);
        fake.loadMetadata(3600);
        fake.dispatchEvent(new Event('timeupdate'));

        expect(fake.seeks).toEqual([125]);
        expect(controller.duration()).toBe(3600);
        controller.destroy();
    });

    it('keeps a handed-over pause through the engine autoplay', () => {
        const { fake, controller } = mount({ startPaused: true });

        void fake.play();
        expect(fake.paused).toBe(true);
        expect(controller.paused()).toBe(true);

        controller.togglePaused();
        expect(fake.paused).toBe(false);
        expect(controller.paused()).toBe(false);
        controller.destroy();
    });

    it('applies the session volume to the element it adopts', () => {
        const { fake, controller } = mount({ volume: 0.4, muted: true });

        expect(fake.volume).toBe(0.4);
        expect(fake.muted).toBe(true);

        controller.toggleMuted();
        expect(fake.muted).toBe(false);
        controller.setVolume(0);
        expect(fake.muted).toBe(true);
        controller.destroy();
    });

    it('skips within the film and repeats it on request', () => {
        const { fake, controller } = mount();
        fake.loadMetadata(100);
        fake.seeks.length = 0;

        controller.seekBy(10);
        controller.seekBy(-30);
        controller.seekTo(500);
        controller.toggleLoop();

        expect(fake.seeks).toEqual([10, 0, 99.5]);
        expect(fake.loop).toBe(true);
        expect(controller.loop()).toBe(true);
        controller.destroy();
    });

    it('stops following the element once destroyed', () => {
        const { fake, controller } = mount();
        controller.destroy();

        void fake.play();

        expect(controller.attached()).toBe(false);
        expect(controller.paused()).toBe(true);
    });

    describe('picture-in-picture', () => {
        function withPictureInPicture(
            options: Partial<
                ConstructorParameters<typeof NowPlayingVideo>[0]
            > = {}
        ) {
            const doc = {
                pictureInPictureEnabled: true,
                pictureInPictureElement: null as unknown,
                exitPictureInPicture: jest.fn(async () => {
                    doc.pictureInPictureElement = null;
                    fake.dispatchEvent(new Event('leavepictureinpicture'));
                }),
            };
            const { fake, controller } = mount(options);
            const request = jest.fn(async () => {
                doc.pictureInPictureElement = fake;
                fake.dispatchEvent(new Event('enterpictureinpicture'));
                return {} as PictureInPictureWindow;
            });
            Object.assign(fake, {
                ownerDocument: doc,
                readyState: 0,
                disablePictureInPicture: false,
                requestPictureInPicture: request,
            });
            return { fake, controller, doc, request };
        }

        it('is offered once the picture has its size, on the same element', async () => {
            const { fake, controller, doc, request } = withPictureInPicture();
            fake.dispatchEvent(new Event('play'));
            expect(controller.canPictureInPicture()).toBe(false);

            Object.assign(fake, { readyState: 1 });
            fake.loadMetadata(100);
            expect(controller.canPictureInPicture()).toBe(true);

            controller.togglePictureInPicture();
            await Promise.resolve();
            expect(request).toHaveBeenCalledTimes(1);
            expect(controller.pictureInPicture()).toBe(true);

            controller.togglePictureInPicture();
            await Promise.resolve();
            expect(doc.exitPictureInPicture).toHaveBeenCalledTimes(1);
            expect(controller.pictureInPicture()).toBe(false);
            controller.destroy();
        });

        it('asks for it again when the page had its picture in PiP', async () => {
            const { fake, controller, request } = withPictureInPicture({
                pictureInPicture: true,
            });
            Object.assign(fake, { readyState: 1 });
            fake.loadMetadata(100);
            fake.dispatchEvent(new Event('timeupdate'));
            await Promise.resolve();

            // Once: a refusal (no recent click) is not retried.
            expect(request).toHaveBeenCalledTimes(1);
            controller.destroy();
        });

        it('offers nothing where the browser has no PiP', () => {
            const { fake, controller, doc } = withPictureInPicture();
            doc.pictureInPictureEnabled = false;
            Object.assign(fake, { readyState: 1 });
            fake.loadMetadata(100);
            expect(controller.canPictureInPicture()).toBe(false);
            controller.destroy();
        });
    });
});
