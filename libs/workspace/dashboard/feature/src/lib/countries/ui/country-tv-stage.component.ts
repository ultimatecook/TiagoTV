import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    linkedSignal,
} from '@angular/core';
import { WebPlayerViewComponent } from '@iptvnator/ui/playback';
import { CountryTvPlayback } from '../country-tv-playback';

/**
 * The picture of "En vivo", the whole page behind its overlay: the live
 * player, and before anything plays (the mini-player was busy, or MPV or
 * VLC is the player) the channel's logo, faint, on a dark ground. The
 * player's own controls bar is hidden and its picture takes no clicks:
 * the page's overlay and keys drive it (`CountryTvControls`).
 */
@Component({
    selector: 'lib-country-tv-stage',
    imports: [WebPlayerViewComponent],
    templateUrl: './country-tv-stage.component.html',
    styleUrl: './country-tv-stage.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryTvStageComponent {
    readonly tv = inject(CountryTvPlayback);

    /** The faint logo; the next copy's when one fails to load. */
    private readonly logoIndex = linkedSignal({
        source: () => this.tv.selection()?.channel.key,
        computation: () => 0,
    });
    readonly logo = computed(
        () => this.tv.selection()?.channel.icons[this.logoIndex()] ?? null
    );

    logoFailed(): void {
        this.logoIndex.update((index) => index + 1);
    }
}
