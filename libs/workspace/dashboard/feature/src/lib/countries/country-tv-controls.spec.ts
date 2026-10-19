import { TestBed } from '@angular/core/testing';
import { CountryTvControls, SHORTCUTS_SUSPENDED } from './country-tv-controls';

/** Lets the MutationObserver callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('CountryTvControls', () => {
    let controls: CountryTvControls;
    let stage: HTMLElement;

    function videoIn(parent: HTMLElement): HTMLVideoElement {
        const video = document.createElement('video');
        let paused = true;
        Object.defineProperty(video, 'paused', { get: () => paused });
        video.play = jest.fn(async () => {
            paused = false;
            video.dispatchEvent(new Event('play'));
        });
        video.pause = jest.fn(() => {
            paused = true;
            video.dispatchEvent(new Event('pause'));
        });
        parent.appendChild(video);
        return video;
    }

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [CountryTvControls] });
        controls = TestBed.inject(CountryTvControls);
        stage = document.createElement('div');
        document.body.appendChild(stage);
        controls.attach(stage);
    });

    afterEach(() => {
        TestBed.resetTestingModule();
        stage.remove();
    });

    it('suspends the player’s own shortcuts on the stage', () => {
        expect(stage.hasAttribute(SHORTCUTS_SUSPENDED)).toBe(true);
    });

    it('follows the player’s video: playing once it plays, stopped on pause', async () => {
        const video = videoIn(stage);
        await settle();
        expect(controls.playing()).toBe(false);

        video.dispatchEvent(new Event('playing'));
        expect(controls.playing()).toBe(true);
        expect(controls.paused()).toBe(true);

        controls.togglePlay();
        await settle();
        expect(video.play).toHaveBeenCalled();
        expect(controls.paused()).toBe(false);

        controls.togglePlay();
        expect(video.pause).toHaveBeenCalled();
        expect(controls.playing()).toBe(false);

        controls.toggleMute();
        expect(video.muted).toBe(true);
        video.dispatchEvent(new Event('volumechange'));
        expect(controls.muted()).toBe(true);
    });

    it('asks the player’s controller first, as its own K and M', async () => {
        const video = videoIn(stage);
        await settle();
        const keys: string[] = [];
        const player = (event: KeyboardEvent) => {
            // The suspension is lifted for the forwarded key only.
            if (!stage.closest(`[${SHORTCUTS_SUSPENDED}]`)) {
                keys.push(event.key);
                event.preventDefault();
            }
        };
        document.addEventListener('keydown', player);

        controls.togglePlay();
        controls.toggleMute();

        document.removeEventListener('keydown', player);
        expect(keys).toEqual(['k', 'm']);
        expect(video.play).not.toHaveBeenCalled();
        expect(video.muted).toBe(false);
        expect(stage.hasAttribute(SHORTCUTS_SUSPENDED)).toBe(true);
    });

    it('rebinds when the engine remounts its video (a zap, a retry)', async () => {
        const first = videoIn(stage);
        await settle();
        first.dispatchEvent(new Event('playing'));
        expect(controls.playing()).toBe(true);

        first.remove();
        const second = videoIn(stage);
        await settle();
        expect(controls.playing()).toBe(false);
        first.dispatchEvent(new Event('playing'));
        expect(controls.playing()).toBe(false);
        second.dispatchEvent(new Event('playing'));
        expect(controls.playing()).toBe(true);
    });

    it('plays at once with Embedded MPV, which has no video', async () => {
        stage.appendChild(document.createElement('app-embedded-mpv-player'));
        await settle();
        expect(controls.playing()).toBe(true);
    });

    it('takes the whole stage full screen, and leaves it', () => {
        stage.requestFullscreen = jest.fn(async () => undefined);
        controls.toggleFullscreen();
        expect(stage.requestFullscreen).toHaveBeenCalled();

        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => stage,
        });
        document.exitFullscreen = jest.fn(async () => undefined);
        document.dispatchEvent(new Event('fullscreenchange'));
        expect(controls.fullscreen()).toBe(true);
        controls.toggleFullscreen();
        expect(document.exitFullscreen).toHaveBeenCalled();
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => null,
        });
    });
});
