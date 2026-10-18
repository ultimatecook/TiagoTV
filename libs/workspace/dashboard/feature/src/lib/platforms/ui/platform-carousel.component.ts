import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlatformTitle } from '../platform-titles';
import type { StreamingPlatform } from '../streaming-platforms';
import { PlatformHeroSlides, titleTypeKey } from './platform-hero-slides';

/**
 * Prime Video's hero: a rounded carousel across the page with arrows at
 * its sides and dots below. Each slide sets the title at the left, over
 * the artwork's fade into navy, with "Included with Prime", the synopsis
 * and the round blue play button.
 */
@Component({
    selector: 'lib-platform-carousel',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './platform-carousel.component.html',
    styleUrl: './platform-carousel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformCarouselComponent {
    readonly platform = input.required<StreamingPlatform>();
    readonly titles = input.required<readonly PlatformTitle[]>();

    readonly hero = new PlatformHeroSlides(this.titles);
    readonly typeKey = titleTypeKey;
}
