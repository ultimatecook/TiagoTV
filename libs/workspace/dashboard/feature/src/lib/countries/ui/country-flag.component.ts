import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LATAM_MOSAIC, type CountryDefinition } from '../countries';

/**
 * A country's flag, as a card of cloth: the bundled flag (4:3) under a
 * soft sheen; "Latinoamérica", which has none, shows four of its
 * countries' flags.
 */
@Component({
    selector: 'lib-country-flag',
    template: `
        @if (definition().flag; as flag) {
            <img class="flag__image" [src]="flag" alt="" draggable="false" />
        } @else {
            <span class="flag__mosaic">
                @for (tile of mosaic; track tile) {
                    <img [src]="tile" alt="" draggable="false" />
                }
            </span>
        }
        <span class="flag__sheen"></span>
    `,
    styles: `
        :host {
            position: relative;
            display: block;
            aspect-ratio: 4 / 3;
            overflow: hidden;
            border-radius: var(--flag-radius, 10px);
            background: #1b1e27;
        }

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            -webkit-user-drag: none;
        }

        .flag__mosaic {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 2px;
            height: 100%;
        }

        /* Light from the top left and a fine edge: a white flag still
           reads as a flag on the dark glass. */
        .flag__sheen {
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background: linear-gradient(
                155deg,
                rgba(255, 255, 255, 0.28) 0%,
                rgba(255, 255, 255, 0.06) 38%,
                transparent 55%,
                rgba(0, 0, 0, 0.16) 100%
            );
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
            pointer-events: none;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { 'aria-hidden': 'true' },
})
export class CountryFlagComponent {
    readonly definition = input.required<CountryDefinition>();
    readonly mosaic = LATAM_MOSAIC;
}
