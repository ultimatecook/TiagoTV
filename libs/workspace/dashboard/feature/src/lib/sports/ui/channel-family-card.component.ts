import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import {
    feedTitle,
    hasWhiteLogo,
    type ChannelFamily,
    type ChannelFeed,
} from '../channel-families';
import { brandOfFamily } from '../live-channels';
import type { SportChannel } from '../sports-catalog';

/**
 * One channel of a competition's page with all its feeds: its logo and
 * name play the first feed, the numbered chips each play theirs.
 */
@Component({
    selector: 'lib-channel-family-card',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './channel-family-card.component.html',
    styleUrl: './channel-family-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelFamilyCardComponent {
    readonly family = input.required<ChannelFamily>();
    readonly playChannel = output<SportChannel>();

    /** Which of the family's logos shows: the next one when it fails. */
    private readonly iconIndex = signal(0);
    readonly icon = computed(
        () => this.family().icons[this.iconIndex()] ?? null
    );
    readonly darkPlate = computed(() =>
        hasWhiteLogo(this.family().key, this.icon())
    );
    /** The competition's logo, for a channel no bundled brand claims. */
    readonly fallbackLogo = input<string | null>(null);
    readonly fallbackTint = input<string | null>(null);
    /**
     * None of the provider's logos loads: the brand's bundled logo on its
     * colour, else the competition's on its tint.
     */
    readonly bundled = computed(() => {
        const brand = brandOfFamily(this.family().key);
        if (brand?.logo) {
            return { logo: brand.logo, background: brand.background };
        }
        const logo = this.fallbackLogo();
        return logo
            ? { logo, background: this.fallbackTint() ?? '#20232c' }
            : null;
    });

    nextIcon(): void {
        this.iconIndex.update((index) => index + 1);
    }

    playFeed(feed: ChannelFeed): void {
        const channel = feed.channels[0];
        this.playChannel.emit({
            ...channel,
            title: feedTitle(this.family(), channel),
        });
    }

    feedLabel(feed: ChannelFeed): string {
        return `${this.family().name} ${feed.number}`;
    }
}
