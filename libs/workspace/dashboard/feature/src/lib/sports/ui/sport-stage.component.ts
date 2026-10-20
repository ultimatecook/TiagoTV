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
import { OVERLAY_IDLE_MS } from '../../countries/country-tv-idle';
import { liveKeyAction, onLivePage } from '../../countries/country-tv-keys';
import { nextFeed, type MatchFeed } from '../match-feeds';
import type { SignalCard } from '../signal-cards';
import { SportFeedFallback } from '../sport-feed-fallback';
import type { SportSection } from '../sport-sections';
import type { SportChannel, SportMatch } from '../sports-catalog';
import { SportTvGuide } from '../sport-tv-guide';
import { SportTvPlayback } from '../sport-tv-playback';
import { injectFeedLanguage } from './feed-language';
import { SportSignalCardComponent } from './sport-signal-card.component';

/** In full screen, the overlay steps aside after this long without a move. */
const IDLE_MS = OVERLAY_IDLE_MS;

/**
 * The top of a competition's page: its channel playing across the whole
 * stage, behind the top bar. At rest, the competition's colour and the
 * channel's logo; top right, the competition and its matches on now; at
 * the bottom, what plays, the controls, the programme's progress and the
 * row of signals, one of which plays. The controls (and Space/K, M, F
 * while the stage is in view) drive the player the way "En vivo" does
 * (`CountryTvControls`): the player's own bar stays hidden.
 *
 * With a match in focus, the row is that match's signals in every
 * language ("Señales de este partido", `feeds`), the competition's
 * channels a click away; when the playing one fails, the next is offered
 * ("Probar otra señal"), or played at once (see SportFeedFallback).
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
    /** The signals of the match in focus (see `feedCards`). */
    readonly feeds = input<readonly SignalCard[]>([]);
    /** The match in focus, if any. */
    readonly match = input<SportMatch | null>(null);
    readonly liveCount = input(0);
    /** "Matches and table": the page below. */
    readonly more = output<void>();

    private readonly fallback = inject(SportFeedFallback);
    private readonly feedLanguage = injectFeedLanguage();
    /** The competition's channels instead of the match's signals. */
    readonly allChannels = linkedSignal({
        source: () => this.match()?.key ?? null,
        computation: () => false,
    });
    /** The row lists the match's signals: it has more than one. */
    readonly feedsView = computed(
        () => this.feeds().length > 1 && !this.allChannels()
    );
    readonly rowCards = computed(() =>
        this.feedsView() ? this.feeds() : this.cards()
    );
    private readonly feedList = computed(() =>
        this.feeds()
            .map((card) => card.feed)
            .filter((feed): feed is MatchFeed => !!feed)
    );

    /** The signal on the stage, when it is one of the rows'. */
    readonly card = computed(() => {
        const streamId = this.tv.selection()?.streamId;
        const on = (card: SignalCard) => card.channel.streamId === streamId;
        return this.feeds().find(on) ?? this.cards().find(on);
    });
    readonly title = computed(
        () =>
            this.card()?.name ??
            this.tv.selection()?.title ??
            this.section().title
    );
    /** The match it carries (and its language), else the guide's programme. */
    readonly programme = computed(() => {
        const card = this.card();
        const match = card?.match?.title;
        const language = this.feedLanguage(card?.feed);
        return match
            ? [match, language].filter(Boolean).join(' · ')
            : (this.guide.nowNext()?.now?.title ?? '');
    });
    /**
     * The match's playing signal failed: the next one to try, or null
     * when every other one failed too.
     */
    readonly failure = computed(() => {
        const streamId = this.tv.selection()?.streamId ?? null;
        const feeds = this.feedList();
        return streamId !== null &&
            feeds.length > 0 &&
            this.fallback.failed() === streamId
            ? { next: nextFeed(feeds, streamId, this.fallback.broken()) }
            : null;
    });
    /** The signal played on its own after one failed, while it plays. */
    readonly switched = computed(() => {
        const feed = this.fallback.switched();
        return feed && feed.channel.streamId === this.tv.selection()?.streamId
            ? this.feedText(feed)
            : '';
    });
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
            // Its height without the veil, on the stage: the player's
            // diagnostic (Retry, the external players) and a native-view
            // picture, which nothing can cover, stay above its controls;
            // the resting logo is centred over them.
            const observer =
                overlay && typeof ResizeObserver !== 'undefined'
                    ? new ResizeObserver(() => {
                          const style = this.stage()?.nativeElement.style;
                          const veil = parseFloat(
                              getComputedStyle(overlay).paddingTop
                          );
                          const height = overlay.offsetHeight;
                          style?.setProperty(
                              '--sport-overlay-content',
                              `${Math.max(0, height - (veil || 0))}px`
                          );
                      })
                    : null;
            if (overlay) {
                // Its border box: the veil alone changes on a short window.
                observer?.observe(overlay, { box: 'border-box' });
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
        this.playChannel(card.channel, true);
    }

    /** Play when nothing plays yet; else pause or play the picture. */
    playPause(): void {
        const selection = this.tv.selection();
        if (!this.tv.playback() && selection) {
            this.playChannel(selection, false);
        } else {
            this.controls.togglePlay();
        }
    }

    /** "Probar otra señal": the next signal of the match. */
    tryNext(): void {
        const next = this.failure()?.next;
        if (next) {
            this.playChannel(next.channel, true);
        }
    }

    /**
     * The player gave up on the stream (its diagnostic, or Embedded MPV's
     * lost stream): the match's next signal plays, when the viewer had
     * not picked this one; else it is offered.
     */
    playbackFailed(): void {
        const selection = this.tv.selection();
        if (!selection) {
            return;
        }
        const next = this.fallback.fail(selection.streamId, this.feedList());
        if (next) {
            this.playChannel(next.channel, false);
        }
    }

    /** The picture moves: a stream that had failed plays again. */
    timeUpdate(event: { currentTime: number; playing?: boolean }): void {
        const streamId = this.tv.selection()?.streamId;
        if (
            streamId !== undefined &&
            event.currentTime > 0 &&
            event.playing !== false
        ) {
            this.fallback.recovered(streamId);
        }
    }

    /** "Inglés (UK) · TNT Sports 1". */
    feedText(feed: MatchFeed): string {
        return `${this.feedLanguage(feed)} · ${feed.name}`;
    }

    /** A signal of the match that failed while it was in focus. */
    isBroken(card: SignalCard): boolean {
        return !!card.feed && this.fallback.broken().has(card.channel.streamId);
    }

    private playChannel(channel: SportChannel, explicit: boolean): void {
        this.fallback.played(channel.streamId, explicit);
        this.tv.play(channel);
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
