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
import {
    copyLabels,
    plateHue,
    type CountryChannel,
    type CountryChannelGroup,
} from '../country-channels';

/**
 * A channel of a country's page: its logo on a plate (its name, on a
 * plate of its colour, when none loads) and its name play the best copy;
 * a chip per copy plays that one ("UHD", "HD", "SD").
 */
@Component({
    selector: 'lib-country-channel-card',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './country-channel-card.component.html',
    styleUrl: './country-channel-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountryChannelCardComponent {
    readonly group = input.required<CountryChannelGroup>();
    readonly playChannel = output<CountryChannel>();

    /** Which of the copies' logos shows: the next one when it fails. */
    private readonly iconIndex = linkedSignal(() => {
        this.group();
        return 0;
    });
    readonly icon = computed(
        () => this.group().icons[this.iconIndex()] ?? null
    );
    readonly hue = computed(() => plateHue(this.group().title));
    /** The name on the plate: large when short, smaller as it grows. */
    readonly wordmarkSize = computed(() => {
        const length = this.group().title.length;
        return length <= 6 ? 'large' : length <= 13 ? 'medium' : 'small';
    });
    readonly labels = computed(() => copyLabels(this.group().copies));

    nextIcon(): void {
        this.iconIndex.update((index) => index + 1);
    }

    play(channel: CountryChannel): void {
        this.playChannel.emit(channel);
    }
}
