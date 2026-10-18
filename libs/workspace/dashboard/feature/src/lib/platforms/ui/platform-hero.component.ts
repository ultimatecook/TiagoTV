import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlatformTitle } from '../platform-titles';
import type { StreamingPlatform } from '../streaming-platforms';
import { PlatformHeroSlides, titleTypeKey } from './platform-hero-slides';
import { PlatformLogoComponent } from './platform-logo.component';

/**
 * The platform page's first card, as the Home's: recommended titles of
 * the platform in turn, the artwork on the right, the title, its match,
 * genres and synopsis on the left, and the way into its page.
 */
@Component({
    selector: 'lib-platform-hero',
    imports: [MatIcon, PlatformLogoComponent, TranslatePipe],
    templateUrl: './platform-hero.component.html',
    styleUrl: './platform-hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformHeroComponent {
    readonly platform = input.required<StreamingPlatform>();
    readonly titles = input.required<readonly PlatformTitle[]>();

    readonly hero = new PlatformHeroSlides(this.titles);
    readonly typeKey = titleTypeKey;
}
