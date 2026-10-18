import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlatformBrandRow } from '../platform-brands';

/**
 * Disney+'s brand tiles under its hero: a raised tile per brand, the
 * brand's mark written in its manner (Marvel's red block, Star Wars'
 * outline, National Geographic's yellow frame), lifting with a white
 * edge under the pointer. A tile opens the brand's titles whole.
 */
@Component({
    selector: 'lib-platform-brands',
    imports: [TranslatePipe],
    templateUrl: './platform-brands.component.html',
    styleUrl: './platform-brands.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformBrandsComponent {
    readonly rows = input.required<readonly PlatformBrandRow[]>();
    /** The id of the brand row to open. */
    readonly open = output<string>();
}
