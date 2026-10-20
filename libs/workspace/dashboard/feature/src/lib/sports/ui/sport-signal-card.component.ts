import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    linkedSignal,
    output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { SignalCard } from '../signal-cards';

/**
 * One signal of a competition's page, a glass card: its logo on a dark
 * screen with the feed's number, its name, and the match it carries. The
 * one on the stage says "Playing".
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
            [attr.aria-pressed]="active()"
            [attr.data-test-id]="'sport-signal-' + item.channel.streamId"
            (click)="picked.emit(item)"
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
                @if (active() && playing()) {
                    <span class="signal__playing">{{
                        'WORKSPACE.SPORTS.PLAYING' | translate
                    }}</span>
                }
            </span>
            <span class="signal__text">
                <span class="signal__name">{{ item.name }}</span>
                <span class="signal__now">
                    @if (item.match) {
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
    readonly picked = output<SignalCard>();

    private readonly logoIndex = linkedSignal({
        source: () => this.card().key,
        computation: () => 0,
    });
    readonly logo = computed(() => this.card().logos[this.logoIndex()] ?? null);

    logoFailed(): void {
        this.logoIndex.update((index) => index + 1);
    }
}
