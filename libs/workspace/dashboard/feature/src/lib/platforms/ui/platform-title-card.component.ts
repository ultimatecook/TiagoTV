import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import type { PlatformTitle } from '../platform-titles';

/** A platform title's poster: opens the title's page. */
@Component({
    selector: 'lib-platform-title-card',
    templateUrl: './platform-title-card.component.html',
    styleUrl: './platform-title-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformTitleCardComponent {
    private readonly catalog = inject(PlatformsCatalogService);

    readonly title = input.required<PlatformTitle>();
    private readonly failed = signal<string | null>(null);
    readonly poster = computed(() => {
        const poster = this.title().poster;
        return poster && poster !== this.failed() ? poster : null;
    });

    open(): void {
        this.catalog.open(this.title());
    }

    posterFailed(url: string): void {
        this.failed.set(url);
    }
}
