import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** A state message as the component shows it: a title, a quieter line. */
export interface PageStateText {
    readonly title: string;
    readonly detail: string;
}

/**
 * Splits a one-string message ("No se pudo cargar el catálogo. Probá de
 * nuevo en un rato.") into its first sentence, the title, and the rest,
 * the line under it. A title loses a final full stop (an ellipsis stays).
 * A `detail` given apart keeps the message whole as the title.
 */
export function splitStateMessage(message: string, detail = ''): PageStateText {
    const text = message.trim();
    const given = detail.trim();
    if (given) {
        return { title: withoutFullStop(text), detail: given };
    }
    const sentences = /^(.+?[.!?…])\s+(\S[\s\S]*)$/u.exec(text);
    return sentences
        ? { title: withoutFullStop(sentences[1]), detail: sentences[2] }
        : { title: withoutFullStop(text), detail: '' };
}

function withoutFullStop(text: string): string {
    return text.replace(/(?<!\.)\.$/u, '');
}

/**
 * One look for the redesigned pages' empty, error and loading messages
 * (Series, Películas, En vivo, Deportes, a competition's page, Buscar): a
 * 16px/600 title, a quieter line under it and, where the page can load
 * again, a white "Retry" pill. `boxed` draws it in a dashed box, where it
 * stands in for a section's content. `message` is already translated.
 */
@Component({
    selector: 'lib-page-state',
    imports: [MatIcon, TranslatePipe],
    template: `
        @let text = parts();
        <p class="page-state__title">{{ text.title }}</p>
        @if (text.detail) {
            <p class="page-state__detail">{{ text.detail }}</p>
        }
        @if (retryable()) {
            <button
                type="button"
                class="page-state__retry"
                data-test-id="page-state-retry"
                (click)="retry.emit()"
            >
                <mat-icon aria-hidden="true">refresh</mat-icon>
                {{ 'RETRY' | translate }}
            </button>
        }
    `,
    styleUrl: './page-state.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class.page-state--boxed]': 'boxed()',
        '[attr.role]': 'role()',
    },
})
export class PageStateComponent {
    readonly message = input.required<string>();
    /** The line under the title; else the message's own second sentence. */
    readonly detail = input('');
    readonly boxed = input(false, { transform: booleanAttribute });
    /** Shows "Retry", which emits `retry`. */
    readonly retryable = input(false, { transform: booleanAttribute });
    readonly role = input<'status' | 'alert' | null>(null);
    readonly retry = output<void>();

    readonly parts = computed(() =>
        splitStateMessage(this.message(), this.detail())
    );
}
