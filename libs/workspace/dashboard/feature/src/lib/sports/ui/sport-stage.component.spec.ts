import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import type { MatchFeed } from '../match-feeds';
import { feedCards, type SignalCard } from '../signal-cards';
import { SportFeedFallback } from '../sport-feed-fallback';
import { findSportSection, type SportSection } from '../sport-sections';
import type { SportChannel, SportMatch } from '../sports-catalog';
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
                SportFeedFallback,
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

describe('SportStageComponent signals of a match', () => {
    let fixture: ComponentFixture<SportStageComponent>;
    let fallback: SportFeedFallback;
    const selection = signal<SportChannel | null>(null);
    const play = jest.fn((channel: SportChannel) => selection.set(channel));
    const feed = (
        streamId: number,
        name: string,
        language: string,
        label: string
    ): MatchFeed => ({
        channel: { streamId, categoryId: '1', title: name, icon: null },
        name,
        number: null,
        language,
        label,
        flag: null,
        named: true,
        quality: null,
    });
    const match = {
        key: 'champions-league|paris saint germain|barcelona',
        keys: [],
        title: 'Paris Saint-Germain - Barcelona',
        streamId: 11,
        feeds: [
            feed(11, 'Movistar Liga de Campeones', 'ES', 'España'),
            feed(31, 'TNT Sports 1', 'UK', 'Inglés (UK)'),
            feed(20, 'UEFA Champions League', 'DE', 'Alemán'),
        ],
    } as unknown as SportMatch;
    const channels: SignalCard[] = [
        {
            key: 'dazn#1',
            name: 'DAZN 1',
            number: null,
            channel: {
                streamId: 7,
                categoryId: '1',
                title: 'DAZN 1',
                icon: null,
            },
            logos: [],
            match: null,
        },
    ];
    const element = () => fixture.nativeElement as HTMLElement;
    const text = (selector: string) =>
        element().querySelector(selector)?.textContent?.trim() ?? '';
    const fail = () => {
        element()
            .querySelector('app-web-player-view')
            ?.dispatchEvent(new Event('playbackFailed'));
        fixture.detectChanges();
    };

    beforeEach(() => {
        play.mockClear();
        selection.set(match.feeds?.[0]?.channel ?? null);
        TestBed.configureTestingModule({
            imports: [SportStageComponent, TranslateModule.forRoot()],
            providers: [
                {
                    provide: SportTvPlayback,
                    useValue: {
                        selection,
                        playback: signal({ streamUrl: 'http://x.test/11.ts' }),
                        sessionKey: signal('session'),
                        leaving: signal(false),
                        embedded: signal(true),
                        play,
                        openExternally: jest.fn(),
                    },
                },
                { provide: SportTvGuide, useValue: { nowNext: signal(null) } },
                SportFeedFallback,
            ],
        });
        TestBed.overrideComponent(SportStageComponent, {
            set: {
                imports: [MatIcon, SportSignalCardComponent, TranslatePipe],
                schemas: [CUSTOM_ELEMENTS_SCHEMA],
            },
        });
        fixture = TestBed.createComponent(SportStageComponent);
        fixture.componentRef.setInput(
            'section',
            findSportSection('champions-league') as SportSection
        );
        fixture.componentRef.setInput('cards', channels);
        fixture.componentRef.setInput('feeds', feedCards(match));
        fixture.componentRef.setInput('match', match);
        fallback = TestBed.inject(SportFeedFallback);
        fallback.focus(match.key);
        fallback.played(11, false);
        fixture.detectChanges();
    });

    const shown = () =>
        [...element().querySelectorAll('lib-sport-signal-card button')].map(
            (button) => button.getAttribute('data-test-id')
        );

    it('lists the match’s signals in every language, the channels a click away', () => {
        expect(text('[data-test-id="sport-row-title"]')).toContain(
            'WORKSPACE.SPORTS.MATCH_FEEDS'
        );
        expect(shown()).toEqual([
            'sport-signal-11',
            'sport-signal-31',
            'sport-signal-20',
        ]);
        expect(
            [
                ...element().querySelectorAll(
                    '[data-test-id="sport-signal-language"]'
                ),
            ].map((chip) => chip.textContent?.trim())
        ).toEqual(['España', 'Inglés (UK)', 'Alemán']);

        (
            element().querySelector(
                '[data-test-id="sport-row-toggle"]'
            ) as HTMLButtonElement
        ).click();
        fixture.detectChanges();
        expect(shown()).toEqual(['sport-signal-7']);
    });

    it('tries the next signal once on its own when the app’s pick fails', () => {
        fail();

        expect(play).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 31 })
        );
        expect(text('[data-test-id="sport-feed-switched"]')).toContain(
            'WORKSPACE.SPORTS.FEED_SWITCHED'
        );

        // That one fails too: offered, not played.
        play.mockClear();
        fail();
        expect(play).not.toHaveBeenCalled();
        const offer = element().querySelector(
            '[data-test-id="sport-feed-try-next"]'
        ) as HTMLButtonElement;
        expect(offer.textContent).toContain(
            'WORKSPACE.SPORTS.TRY_ANOTHER_FEED'
        );
        expect(offer.textContent).toContain('Alemán · UEFA Champions League');

        offer.click();
        expect(play).toHaveBeenCalledWith(
            expect.objectContaining({ streamId: 20 })
        );
    });

    it('only offers another signal when the viewer picked the one that fails', () => {
        (
            element().querySelector(
                '[data-test-id="sport-signal-20"]'
            ) as HTMLButtonElement
        ).click();
        play.mockClear();
        fixture.detectChanges();

        fail();

        expect(play).not.toHaveBeenCalled();
        expect(text('[data-test-id="sport-feed-fallback"]')).toContain(
            'WORKSPACE.SPORTS.FEED_FAILED'
        );
        // The next one after it, from the start: Spain's.
        expect(text('[data-test-id="sport-feed-try-next"]')).toContain(
            'España · Movistar Liga de Campeones'
        );
        expect(
            element().querySelector('[data-test-id="sport-signal-20"]')
                ?.textContent
        ).toContain('WORKSPACE.SPORTS.FEED_NO_SIGNAL');
    });
});
