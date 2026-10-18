import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { SportsCatalogService } from '../sports-catalog.service';
import type { SportSectionId } from '../sport-sections';

/**
 * A team's crest, or its initials on a disc while none is known (looked up
 * on TheSportsDB through the sports service's cache).
 */
@Component({
    selector: 'lib-team-crest',
    template: `
        @if (url(); as src) {
            <img
                class="crest__image"
                [src]="src"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                (error)="url.set(null)"
            />
        } @else {
            <span class="crest__initials" aria-hidden="true">{{
                initials()
            }}</span>
        }
    `,
    styles: `
        :host {
            display: grid;
            place-items: center;
            width: var(--crest-size, 56px);
            height: var(--crest-size, 56px);
        }

        .crest__image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.45));
            -webkit-user-drag: none;
        }

        .crest__initials {
            display: grid;
            place-items: center;
            width: 86%;
            height: 86%;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.12);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
            color: var(--app-heading-color);
            font-size: calc(var(--crest-size, 56px) * 0.32);
            font-weight: 700;
            letter-spacing: 0.02em;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamCrestComponent {
    private readonly sports = inject(SportsCatalogService);

    readonly team = input.required<string>();
    readonly section = input<SportSectionId | null>(null);
    readonly url = signal<string | null>(null);
    readonly initials = computed(() =>
        this.team()
            .replace(/\b(fc|cf|rc|ad|sd|cd|ud|afc|sc|ac)\b/gi, '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word[0]?.toUpperCase() ?? '')
            .join('')
    );

    constructor() {
        effect((onCleanup) => {
            const team = this.team();
            const section = this.section();
            let current = true;
            onCleanup(() => (current = false));
            this.url.set(null);
            void this.sports.crests.resolve(team, section).then((url) => {
                if (current) {
                    this.url.set(url);
                }
            });
        });
    }
}
