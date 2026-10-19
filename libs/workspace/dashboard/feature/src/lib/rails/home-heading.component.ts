import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A Home section's heading (README 01 · Inicio): the h2, an optional
 * quiet subtitle beside it ("4 en vivo · 18 eventos", "En tus
 * plataformas") and "Ver todo" on the right, to the section's own page.
 */
@Component({
    selector: 'lib-home-heading',
    imports: [RouterLink, TranslatePipe],
    template: `
        <div class="heading__titles">
            <h2 class="heading__title" [attr.id]="headingId() || null">
                {{ title() }}
            </h2>
            @if (subtitle()) {
                <span class="heading__subtitle">{{ subtitle() }}</span>
            }
        </div>
        @if (link(); as link) {
            <a
                class="heading__link"
                [routerLink]="link"
                [state]="linkState() ?? {}"
                [attr.data-test-id]="testId() ? testId() + '-see-all' : null"
                >{{ 'WORKSPACE.DASHBOARD.SEE_ALL' | translate }}</a
            >
        }
    `,
    styleUrl: './home-heading.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeHeadingComponent {
    readonly title = input.required<string>();
    readonly subtitle = input<string | null>(null);
    readonly link = input<string[] | null>(null);
    readonly linkState = input<Record<string, unknown> | null>(null);
    readonly headingId = input<string | null>(null);
    readonly testId = input<string | null>(null);
}
