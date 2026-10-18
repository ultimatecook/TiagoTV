import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { StreamingPlatform } from '../streaming-platforms';

/** A platform's logo, or its name written in its colour where none ships. */
@Component({
    selector: 'lib-platform-logo',
    template: `
        @if (platform().logo; as logo) {
            <img
                class="logo"
                [class.logo--white]="platform().logoTone === 'white'"
                [src]="logo"
                [alt]="platform().name"
                draggable="false"
            />
        } @else {
            <span class="wordmark" [style.color]="platform().wordmarkColor">{{
                platform().name
            }}</span>
        }
    `,
    styles: `
        :host {
            display: grid;
            place-items: center;
            min-width: 0;
        }

        .logo {
            display: block;
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            -webkit-user-drag: none;
        }

        .logo--white {
            filter: brightness(0) invert(1);
        }

        .wordmark {
            overflow: hidden;
            font-family: 'DM Sans', 'Roboto', sans-serif;
            font-size: var(--platform-wordmark-size, 28px);
            font-weight: 700;
            letter-spacing: -0.03em;
            line-height: 1;
            text-overflow: ellipsis;
            text-transform: none;
            white-space: nowrap;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformLogoComponent {
    readonly platform = input.required<StreamingPlatform>();
}
