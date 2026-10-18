import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlatformLook } from '../platform-design';
import type { PlatformTitle } from '../platform-titles';
import type { StreamingPlatform } from '../streaming-platforms';
import { PlatformHeroSlides, titleTypeKey } from './platform-hero-slides';

/**
 * The rounded hero carousel of Prime Video, Disney+ and mitele: a slide
 * across the page with arrows at its sides and dots below, the title at
 * the left over the artwork's fade. Prime's adds "Included with Prime"
 * and the round blue play button; the others a labelled play button
 * ("REPRODUCIR") beside "More info".
 */
@Component({
    selector: 'lib-platform-carousel',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './platform-carousel.component.html',
    styleUrl: './platform-carousel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { '[attr.data-look]': 'look()' },
})
export class PlatformCarouselComponent {
    readonly platform = input.required<StreamingPlatform>();
    readonly titles = input.required<readonly PlatformTitle[]>();
    readonly look = input<PlatformLook>('prime');
    readonly playKey = input('WORKSPACE.PLATFORMS.WATCH');

    readonly hero = new PlatformHeroSlides(this.titles);
    readonly typeKey = titleTypeKey;
}
