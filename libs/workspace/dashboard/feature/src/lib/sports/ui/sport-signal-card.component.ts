import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    linkedSignal,
    output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ChannelFavoritesService } from '../../my-list/channel-favorites.service';
import type { SignalCard } from '../signal-cards';
import { feedFlag, injectFeedLanguage } from './feed-language';

/**
 * One signal of a competition's page, a glass card: its logo on a dark
 * screen with the feed's number, its name, and the match it carries. The
 * one on the stage says "Playing". A signal of the match in focus says
 * its language instead (a flag where one is bundled), its quality, and
 * whether its name carries the match or it may show it; one that failed
 * says so. Its heart (on hover, or always once saved), or L on the card,
 * puts the signal's channel on Mi lista.
 */
@Component({
    selector: 'lib-sport-signal-card',
    imports: [MatIcon, TranslatePipe],
    template: `
        @let item = card();
        <button
            type="button"
            class="signal"
            [class.signal--on]="active()"
            [class.signal--saved]="saved()"
            [attr.aria-pressed]="active()"
            [attr.data-test-id]="'sport-signal-' + item.channel.streamId"
            (click)="picked.emit(item)"
            (keydown)="onKeydown($event)"
        >
            <span class="signal__screen">
                @if (logo(); as src) {
                    <img
                        class="signal__logo"
                        [src]="src"
                        alt=""
                        referrerpolicy="no-referrer"
                        draggable="false"
                        (error)="logoFailed()"
                    />
                } @else if (fallbackLogo(); as src) {
                    <img
                        class="signal__logo"
                        [src]="src"
                        alt=""
                        draggable="false"
                    />
                } @else {
                    <mat-icon class="signal__icon" aria-hidden="true"
                        >live_tv</mat-icon
                    >
                }
                @if (item.number !== null) {
                    <span class="signal__number" aria-hidden="true">{{
                        item.number
                    }}</span>
                }
                @if (item.feed?.quality; as quality) {
                    <span class="signal__quality">{{ quality }}</span>
                }
                @if (failed()) {
                    <span class="signal__failed">{{
                        'WORKSPACE.SPORTS.FEED_NO_SIGNAL' | translate
                    }}</span>
                } @else if (active() && playing()) {
                    <span class="signal__playing">{{
                        'WORKSPACE.SPORTS.PLAYING' | translate
                    }}</span>
                }
            </span>
            <span class="signal__text">
                <span class="signal__name">{{ item.name }}</span>
                <span class="signal__now">
                    @if (item.feed; as feed) {
                        <span
                            class="signal__lang"
                            data-test-id="sport-signal-language"
                        >
                            @if (flag(); as src) {
                                <img
                                    class="signal__flag"
                                    [src]="src"
                                    alt=""
                                    draggable="false"
                                />
                            }
                            {{ language() }}
                        </span>
                        @if (!feed.named) {
                            <span class="signal__note">{{
                                'WORKSPACE.SPORTS.FEED_VIA' | translate
                            }}</span>
                        }
                    } @else if (item.match) {
                        <i class="signal__dot" aria-hidden="true"></i>
                        {{ item.match.title }}
                    } @else {
                        {{ subtitle() }}
                    }
                </span>
            </span>
            @if (active() && progress() !== null) {
                <span class="signal__bar" aria-hidden="true">
                    <i [style.width.%]="progress()"></i>
                </span>
            }
        </button>
        <!-- Out of the tab order: L on the card does the same. -->
        <button
            type="button"
            class="fav"
            tabindex="-1"
            [class.fav--on]="saved()"
            [attr.data-test-id]="'sport-signal-fav-' + item.channel.streamId"
            [attr.aria-label]="
                (saved()
                    ? 'WORKSPACE.MY_LIST.REMOVE_NAMED'
                    : 'WORKSPACE.MY_LIST.ADD_NAMED'
                ) | translate: { name: item.name }
            "
            [attr.aria-pressed]="saved()"
            (click)="toggleFavorite()"
        >
            <mat-icon aria-hidden="true">{{
                saved() ? 'favorite' : 'favorite_border'
            }}</mat-icon>
        </button>
    `,
    styleUrl: './sport-signal-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SportSignalCardComponent {
    readonly card = input.required<SignalCard>();
    readonly active = input(false);
    /**
     * The stage's stream is on: "Playing" shows on the active card only
     * then, not while the stage waits for Play (the mini-player kept
     * another page's stream).
     */
    readonly playing = input(true);
    /** The line under the name when no match is known: the competition. */
    readonly subtitle = input('');
    /** The programme's progress on the playing signal. */
    readonly progress = input<number | null>(null);
    /** The competition's logo, when none of the signal's loads. */
    readonly fallbackLogo = input<string | null>(null);
    /** The signal failed while the match was in focus. */
    readonly failed = input(false);
    readonly picked = output<SignalCard>();

    private readonly favorites = inject(ChannelFavoritesService);
    /** The signal's channel is on Mi lista. */
    readonly saved = computed(() =>
        this.favorites.has(this.card().channel.streamId)
    );
    private readonly feedLanguage = injectFeedLanguage();
    readonly language = computed(() => this.feedLanguage(this.card().feed));
    readonly flag = computed(() => {
        const feed = this.card().feed;
        return feed ? feedFlag(feed) : null;
    });

    private readonly logoIndex = linkedSignal({
        source: () => this.card().key,
        computation: () => 0,
    });
    readonly logo = computed(() => this.card().logos[this.logoIndex()] ?? null);

    logoFailed(): void {
        this.logoIndex.update((index) => index + 1);
    }

    toggleFavorite(): void {
        void this.favorites.toggle(this.card().channel.streamId);
    }

    /** L on the card: this signal, not the stage's (the stage's own L). */
    onKeydown(event: KeyboardEvent): void {
        if (
            (event.key === 'l' || event.key === 'L') &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
        ) {
            event.preventDefault();
            this.toggleFavorite();
        }
    }
}
