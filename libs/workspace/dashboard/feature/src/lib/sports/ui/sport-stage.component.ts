import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    linkedSignal,
    output,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { WebPlayerViewComponent } from '@iptvnator/ui/playback';
import { CountryTvControls } from '../../countries/country-tv-controls';
import { liveKeyAction, onLivePage } from '../../countries/country-tv-keys';
import type { SignalCard } from '../signal-cards';
import type { SportSection } from '../sport-sections';
import { SportTvGuide } from '../sport-tv-guide';
import { SportTvPlayback } from '../sport-tv-playback';
import { SportSignalCardComponent } from './sport-signal-card.component';

/** In full screen, the overlay steps aside after this long without a move. */
const IDLE_MS = 3500;

/**
 * The top of a competition's page: its channel playing across the whole
 * stage, behind the top bar. At rest, the competition's colour and the
 * channel's logo; top right, the competition and its matches on now; at
 * the bottom, what plays, the controls, the programme's progress and the
 * row of signals, one of which plays. The controls (and Space/K, M, F
 * while the stage is in view) drive the player the way "En vivo" does
 * (`CountryTvControls`): the player's own bar stays hidden.
 */
@Component({
    selector: 'lib-sport-stage',
    imports: [
        MatIcon,
        SportSignalCardComponent,
        TranslatePipe,
        WebPlayerViewComponent,
    ],
    providers: [CountryTvControls],
    templateUrl: './sport-stage.component.html',
    styleUrl: './sport-stage.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportStageComponent {
    readonly tv = inject(SportTvPlayback);
    readonly guide = inject(SportTvGuide);
    readonly controls = inject(CountryTvControls);
    private readonly host: HTMLElement = inject(ElementRef).nativeElement;
    private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
    private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');

    readonly section = input.required<SportSection>();
    readonly cards = input<readonly SignalCard[]>([]);
    readonly liveCount = input(0);
    /** "Matches and table": the page below. */
    readonly more = output<void>();

    /** The signal on the stage, when it is one of the row's. */
    readonly card = computed(() => {
        const streamId = this.tv.selection()?.streamId;
        return this.cards().find((card) => card.channel.streamId === streamId);
    });
    readonly title = computed(
        () =>
            this.card()?.name ??
            this.tv.selection()?.title ??
            this.section().title
    );
    /** The match it carries, else the guide's programme on now. */
    readonly programme = computed(
        () =>
            this.card()?.match?.title ?? this.guide.nowNext()?.now?.title ?? ''
    );
    readonly progress = computed(
        () => this.guide.nowNext()?.now?.progress ?? null
    );
    /** The resting screen's logo: the signal's, the next when one fails. */
    private readonly logoIndex = linkedSignal({
        source: () => this.tv.selection()?.streamId,
        computation: () => 0,
    });
    readonly restingLogo = computed(() => {
        const logos = this.card()?.logos ?? [];
        return logos[this.logoIndex()] ?? this.section().logo;
    });
    /** Full screen and still: the overlay fades out. */
    readonly idle = signal(false);
    private idleTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        const destroyRef = inject(DestroyRef);
        effect(() => {
            const stage = this.stage()?.nativeElement;
            if (stage) {
                untracked(() => this.controls.attach(stage));
            }
        });
        effect(() => {
            this.controls.fullscreen();
            untracked(() => this.wake());
        });
        afterNextRender(() => {
            const key = (event: KeyboardEvent) => this.onKeydown(event);
            document.addEventListener('keydown', key);
            const overlay = this.overlay()?.nativeElement;
            // Its height, on the stage: the player's diagnostic (Retry, the
            // external players) stays above it.
            // Without the veil, its controls' height: a native-view picture,
            // which nothing can cover, stays above them.
            const observer =
                overlay && typeof ResizeObserver !== 'undefined'
                    ? new ResizeObserver(() => {
                          const style = this.stage()?.nativeElement.style;
                          const veil = parseFloat(
                              getComputedStyle(overlay).paddingTop
                          );
                          const height = overlay.offsetHeight;
                          style?.setProperty(
                              '--sport-overlay-h',
                              `${height}px`
                          );
                          style?.setProperty(
                              '--sport-overlay-content',
                              `${Math.max(0, height - (veil || 0))}px`
                          );
                      })
                    : null;
            if (overlay) {
                observer?.observe(overlay);
            }
            const scroller = this.fitScroller();
            destroyRef.onDestroy(() => {
                document.removeEventListener('keydown', key);
                observer?.disconnect();
                scroller?.disconnect();
            });
        });
        destroyRef.onDestroy(() => this.clearIdle());
    }

    logoFailed(): void {
        this.logoIndex.update((index) => index + 1);
    }

    play(card: SignalCard): void {
        this.tv.play(card.channel);
    }

    /** Play when nothing plays yet; else pause or play the picture. */
    playPause(): void {
        const selection = this.tv.selection();
        if (!this.tv.playback() && selection) {
            this.tv.play(selection);
        } else {
            this.controls.togglePlay();
        }
    }

    /** A move over the stage brings the overlay back for a while. */
    wake(): void {
        this.idle.set(false);
        this.clearIdle();
        if (this.controls.fullscreen() && this.tv.playback()) {
            this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_MS);
        }
    }

    /** The remote's keys, while the stage is in view or full screen. */
    private onKeydown(event: KeyboardEvent): void {
        const stage = this.stage()?.nativeElement;
        if (
            !stage ||
            this.controls.isForwarded(event) ||
            !onLivePage(event, stage.closest('article') ?? stage) ||
            (!this.controls.fullscreen() &&
                stage.getBoundingClientRect().bottom < window.innerHeight / 2)
        ) {
            return;
        }
        // Any key brings the overlay back, as a move does: in full screen
        // the focus can sit on its faded buttons, whose own keys (Tab, the
        // arrows) must still show where it is.
        this.wake();
        const action = liveKeyAction(event);
        // Esc leaves full screen where the window lets the page see it.
        if (action === 'collapse') {
            if (this.controls.exitFullscreen()) {
                event.preventDefault();
            }
            return;
        }
        if (action === 'play' || action === 'mute' || action === 'fullscreen') {
            event.preventDefault();
            if (action === 'play') {
                this.playPause();
            } else if (action === 'mute') {
                this.controls.toggleMute();
            } else {
                this.controls.toggleFullscreen();
            }
        }
    }

    /**
     * The stage is as tall as the page's scroller shows (the window's
     * content area, the top bar over it), not the screen's 100vh.
     */
    private fitScroller(): ResizeObserver | null {
        let scroller = this.host.parentElement;
        while (
            scroller &&
            !/auto|scroll/.test(getComputedStyle(scroller).overflowY)
        ) {
            scroller = scroller.parentElement;
        }
        if (!scroller || typeof ResizeObserver === 'undefined') {
            return null;
        }
        const view = scroller;
        const observer = new ResizeObserver(() =>
            this.host.style.setProperty(
                '--sport-stage-h',
                `${view.clientHeight}px`
            )
        );
        observer.observe(view);
        return observer;
    }

    private clearIdle(): void {
        if (this.idleTimer !== null) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
}
