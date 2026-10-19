import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    linkedSignal,
    output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { WebPlayerViewComponent } from '@iptvnator/ui/playback';
import { copyLabels } from '../country-channels';
import { CountryTvGuide } from '../country-tv-guide';
import { CountryTvPlayback } from '../country-tv-playback';

/**
 * The top of "Por países": the live player, and beside it what plays —
 * the channel's logo and name, its country and row, now and next when the
 * guide has them, and its other copies ("UHD", "HD"). Before anything
 * plays (the mini-player was busy, or MPV/VLC is the player), the screen
 * offers the channel with a Play button.
 */
@Component({
    selector: 'lib-country-tv-stage',
    imports: [MatIcon, TranslatePipe, WebPlayerViewComponent],
    templateUrl: './country-tv-stage.component.html',
    styleUrl: './country-tv-stage.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryTvStageComponent {
    readonly tv = inject(CountryTvPlayback);
    readonly guide = inject(CountryTvGuide);
    /** "Open in Live TV": the channel in the Xtream live view. */
    readonly openLiveView = output<void>();

    readonly selection = this.tv.selection;
    readonly copies = computed(() => {
        const copies = this.selection()?.channel.copies ?? [];
        const labels = copyLabels(copies);
        return copies.map((copy, index) => ({ copy, label: labels[index] }));
    });
    /** The panel's logo; the next copy's when one fails to load. */
    private readonly logoIndex = linkedSignal({
        source: () => this.selection()?.channel.key,
        computation: () => 0,
    });
    readonly logo = computed(
        () => this.selection()?.channel.icons[this.logoIndex()] ?? null
    );

    logoFailed(): void {
        this.logoIndex.update((index) => index + 1);
    }

    playSelection(): void {
        const selection = this.selection();
        if (selection) {
            this.tv.play(selection);
        }
    }
}
