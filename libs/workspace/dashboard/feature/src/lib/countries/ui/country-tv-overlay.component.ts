import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    input,
    model,
    output,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { copyLabels, type CountryChannel } from '../country-channels';
import type {
    TvCard,
    TvCategory,
    TvCategoryId,
} from '../country-tv-categories';
import { CountryTvControls } from '../country-tv-controls';
import { CountryTvListings } from '../country-tv-listings';
import { CountryTvPlayback } from '../country-tv-playback';
import { CountryTvCardsComponent } from './country-tv-cards.component';

/**
 * The bottom of "En vivo", over the picture (handoff 04): the channel's
 * name and what it shows now, the controls (play/pause, sound, Live TV,
 * full screen) and the programme's progress, the country's category chips
 * and its channels in glass cards. The channel's other feeds ("UHD",
 * "HD"), when it has any, sit beside the controls.
 */
@Component({
    selector: 'lib-country-tv-overlay',
    imports: [CountryTvCardsComponent, MatIcon, TranslatePipe],
    templateUrl: './country-tv-overlay.component.html',
    styleUrl: './country-tv-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryTvOverlayComponent {
    readonly categories = input.required<readonly TvCategory[]>();
    readonly category = model.required<TvCategoryId>();
    readonly cards = input.required<readonly TvCard[]>();
    /** The country's name, for the row's accessible name. */
    readonly countryName = input('');
    readonly picked = output<TvCard>();
    readonly openLiveView = output<void>();
    /** The pointer is on the overlay (it stays on screen). */
    readonly hovering = output<boolean>();

    readonly tv = inject(CountryTvPlayback);
    readonly controls = inject(CountryTvControls);
    private readonly listings = inject(CountryTvListings);
    private readonly row = viewChild(CountryTvCardsComponent);

    readonly selection = this.tv.selection;
    readonly playingStreamId = computed(
        () => this.selection()?.copy.streamId ?? null
    );
    /** What the channel shows now, when the guide or the sports know. */
    readonly now = computed(() => {
        const selection = this.selection();
        return selection ? this.listings.nowOn(selection.channel) : null;
    });
    readonly copies = computed(() => {
        const copies = this.selection()?.channel.copies ?? [];
        const labels = copyLabels(copies);
        return copies.map((copy, index) => ({ copy, label: labels[index] }));
    });

    constructor() {
        // Its height, on the page: the player's diagnostic stays above it.
        const host: HTMLElement = inject(ElementRef).nativeElement;
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            if (typeof ResizeObserver === 'undefined') {
                return;
            }
            const observer = new ResizeObserver(() =>
                host.parentElement?.style.setProperty(
                    '--live-overlay-height',
                    `${host.offsetHeight}px`
                )
            );
            observer.observe(host);
            destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    /** Play when nothing plays yet; else pause or play the picture. */
    playPause(): void {
        const selection = this.selection();
        if (!this.tv.playback() && selection) {
            this.tv.play(selection);
        } else {
            this.controls.togglePlay();
        }
    }

    playCopy(copy: CountryChannel): void {
        this.tv.playCopy(copy);
    }

    pickCategory(category: TvCategoryId): void {
        this.category.set(category);
    }

    /** The page's arrows, with the overlay hidden: to the playing card. */
    focusCards(): void {
        this.row()?.focusPlaying();
    }
}
