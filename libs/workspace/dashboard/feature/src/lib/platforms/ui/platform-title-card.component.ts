import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import type { PlatformLook } from '../platform-design';
import { genreLabelKey } from '../platform-genres';
import type { PlatformTitle } from '../platform-titles';
import { titleTypeKey } from './platform-hero-slides';

/**
 * A platform title's tile: opens the title's page. A 2:3 poster, or the
 * 16:9 artwork of Netflix, Prime Video and Apple TV (the backdrop where
 * the catalog has one, else the poster cropped), dressed as the platform
 * dresses its own.
 */
@Component({
    selector: 'lib-platform-title-card',
    imports: [TranslatePipe],
    templateUrl: './platform-title-card.component.html',
    styleUrl: './platform-title-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[attr.data-look]': 'look()',
        '[attr.data-tile]': 'tile()',
    },
})
export class PlatformTitleCardComponent {
    private readonly catalog = inject(PlatformsCatalogService);

    readonly title = input.required<PlatformTitle>();
    readonly look = input<PlatformLook>('default');
    readonly tile = input<'landscape' | 'poster'>('poster');
    /** Its place in a Top 10, read out with the title. */
    readonly rank = input<number | null>(null);

    private readonly failed = signal<ReadonlySet<string>>(new Set());
    /** The artwork to show, skipping any that failed to load. */
    readonly art = computed(() => {
        const title = this.title();
        const backdrop =
            title.backdrop ?? this.catalog.extrasOf(title)?.backdrop ?? null;
        const candidates =
            this.tile() === 'landscape'
                ? [backdrop, title.poster]
                : [title.poster, backdrop];
        const failed = this.failed();
        const url = candidates.find((item) => !!item && !failed.has(item));
        return url
            ? {
                  url,
                  cropped: url === title.poster && this.tile() === 'landscape',
              }
            : null;
    });
    readonly label = computed(() => {
        const rank = this.rank();
        return rank ? `${rank}. ${this.title().title}` : this.title().title;
    });
    /** "Series · Drama", under Apple TV's cards. */
    readonly typeKey = computed(() => titleTypeKey(this.title()));
    readonly genreKey = computed(() => {
        const genre = this.title().genres[0];
        return genre ? genreLabelKey(genre) : null;
    });

    open(): void {
        this.catalog.open(this.title());
    }

    artFailed(url: string): void {
        this.failed.update((failed) => new Set(failed).add(url));
    }
}
