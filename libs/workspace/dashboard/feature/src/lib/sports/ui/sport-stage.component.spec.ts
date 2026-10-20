import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { findSportSection, type SportSection } from '../sport-sections';
import { SportTvGuide } from '../sport-tv-guide';
import { SportTvPlayback } from '../sport-tv-playback';
import { SportSignalCardComponent } from './sport-signal-card.component';
import { SportStageComponent } from './sport-stage.component';

describe('SportStageComponent full screen', () => {
    let fixture: ComponentFixture<SportStageComponent>;
    const fullscreenIs = (element: Element | null) =>
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            get: () => element,
        });
    const key = (target: EventTarget, name: string) =>
        target.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: name,
                bubbles: true,
                cancelable: true,
            })
        );
    const element = () => fixture.nativeElement as HTMLElement;
    const stage = () => element().querySelector('.stage') as HTMLElement;
    const fullscreenButton = () =>
        element().querySelectorAll<HTMLButtonElement>('.stage__control')[2];

    beforeEach(async () => {
        document.exitFullscreen = jest.fn(async () => undefined);
        TestBed.configureTestingModule({
            imports: [SportStageComponent, TranslateModule.forRoot()],
            providers: [
                {
                    provide: SportTvPlayback,
                    useValue: {
                        selection: signal({ streamId: 7, title: 'DAZN 1' }),
                        playback: signal({ streamUrl: 'http://x.test/7.ts' }),
                        sessionKey: signal('session'),
                        leaving: signal(false),
                        embedded: signal(true),
                        play: jest.fn(),
                        openExternally: jest.fn(),
                    },
                },
                {
                    provide: SportTvGuide,
                    useValue: { nowNext: signal(null) },
                },
            ],
        });
        TestBed.overrideComponent(SportStageComponent, {
            // The web player stays an empty element: a test adds the
            // engine it needs.
            set: {
                imports: [MatIcon, SportSignalCardComponent, TranslatePipe],
                schemas: [CUSTOM_ELEMENTS_SCHEMA],
            },
        });
        fixture = TestBed.createComponent(SportStageComponent);
        fixture.componentRef.setInput(
            'section',
            findSportSection('laliga') as SportSection
        );
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    afterEach(() => fullscreenIs(null));

    it('leaves on F from the button just pressed, and on Esc', async () => {
        stage().requestFullscreen = jest.fn(async () => {
            fullscreenIs(stage());
            document.dispatchEvent(new Event('fullscreenchange'));
        });
        const button = fullscreenButton();
        button.focus();
        button.click();
        expect(stage().requestFullscreen).toHaveBeenCalled();

        key(button, 'f');
        expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
        key(button, 'Escape');
        expect(document.exitFullscreen).toHaveBeenCalledTimes(2);
    });

    it('pauses on Space from a control just clicked, not presses it again', () => {
        // In view: the page's keys drive the stage.
        stage().getBoundingClientRect = () =>
            ({ bottom: window.innerHeight }) as DOMRect;
        const controls = fixture.componentInstance.controls;
        const togglePlay = jest
            .spyOn(controls, 'togglePlay')
            .mockImplementation(() => undefined);
        const toggleMute = jest
            .spyOn(controls, 'toggleMute')
            .mockImplementation(() => undefined);
        const mute =
            element().querySelectorAll<HTMLButtonElement>('.stage__control')[1];
        mute.focus();
        const space = new KeyboardEvent('keydown', {
            key: ' ',
            bubbles: true,
            cancelable: true,
        });
        mute.dispatchEvent(space);

        expect(togglePlay).toHaveBeenCalledTimes(1);
        expect(toggleMute).not.toHaveBeenCalled();
        // Prevented, so the focused button is not pressed by the key.
        expect(space.defaultPrevented).toBe(true);
    });

    it('brings the faded overlay back on any key in full screen', () => {
        jest.useFakeTimers();
        try {
            stage().requestFullscreen = jest.fn(async () => {
                fullscreenIs(stage());
                document.dispatchEvent(new Event('fullscreenchange'));
            });
            const button = fullscreenButton();
            button.focus();
            button.click();
            fixture.detectChanges();
            jest.advanceTimersByTime(4000);
            fixture.detectChanges();
            expect(stage().classList).toContain('stage--idle');

            // The focus sits on the faded button: an arrow is its own key,
            // and still shows the overlay again.
            key(button, 'ArrowRight');
            fixture.detectChanges();
            expect(stage().classList).not.toContain('stage--idle');
        } finally {
            jest.useRealTimers();
        }
    });

    it('hands full screen to a native-view Embedded MPV picture', async () => {
        const view = element().querySelector(
            'app-web-player-view'
        ) as HTMLElement;
        view.appendChild(document.createElement('app-embedded-mpv-player'));
        view.requestFullscreen = jest.fn(async () => undefined);
        stage().requestFullscreen = jest.fn(async () => undefined);
        await new Promise((resolve) => setTimeout(resolve));
        fixture.detectChanges();
        // Its picture keeps clear of the bar, the pill and the overlay.
        expect(stage().classList).toContain('stage--native');

        fullscreenButton().click();
        expect(view.requestFullscreen).toHaveBeenCalled();
        expect(stage().requestFullscreen).not.toHaveBeenCalled();
    });
});
