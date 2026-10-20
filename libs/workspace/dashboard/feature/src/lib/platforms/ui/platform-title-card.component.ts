import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { formatRating } from '@iptvnator/pipes';
import { PlatformsCatalogService } from '../platforms-catalog.service';
import type { PlatformLook, TileDress } from '../platform-design';
import { genreLabelKey } from '../platform-genres';
import { languagesLabel, type PlatformTitle } from '../platform-titles';
import { SharpImagePipe } from '../../sharp-image.pipe';
import { titleTypeKey } from './platform-hero-slides';

/** TiagoTV's own tile: a poster with its name under it. */
const POSTER: TileDress = {
    tile: 'poster',
    large: false,
    caption: false,
    sub: false,
    info: false,
};

/**
 * A platform title's tile: opens the title's page (its Spanish version,
 * where it has one). A 2:3 poster, or the 16:9 artwork of Netflix, Prime
 * Video, HBO Max… (the backdrop where the catalog has one, else the poster
 * cropped), dressed as the platform dresses its own (`TileDress`): the
 * name on the artwork or under it, the kind and genre, and the facts
 * (rating, year, synopsis) the pointer or the keyboard opens on it.
 */
@Component({
    selector: 'lib-platform-title-card',
    imports: [NgTemplateOutlet, SharpImagePipe, TranslatePipe],
    templateUrl: './platform-title-card.component.html',
    styleUrl: './platform-title-card.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[attr.data-look]': 'look()',
        '[attr.data-tile]': 'dress().tile',
        '[attr.data-size]': "dress().large ? 'large' : null",
    },
})
export class PlatformTitleCardComponent {
    private readonly catalog = inject(PlatformsCatalogService);

    readonly title = input.required<PlatformTitle>();
    readonly look = input<PlatformLook>('default');
    readonly dress = input<TileDress>(POSTER);
    /** Its place in a Top 10, read out with the title. */
    readonly rank = input<number | null>(null);

    private readonly failed = signal<ReadonlySet<string>>(new Set());
    /** The artwork to show, skipping any that failed to load. */
    readonly art = computed(() => {
        const title = this.title();
        const landscape = this.dress().tile === 'landscape';
        const backdrop =
            title.backdrop ?? this.catalog.extrasOf(title)?.backdrop ?? null;
        const candidates = landscape
            ? [backdrop, title.poster]
            : [title.poster, backdrop];
        const failed = this.failed();
        const url = candidates.find((item) => !!item && !failed.has(item));
        if (!url) {
            return null;
        }
        // About as wide as the tile draws (CSS px), for a sharp copy: a
        // cropped poster fills a 16:9 tile's whole width.
        const large = this.dress().large;
        return {
            url,
            cropped: url === title.poster && landscape,
            kind: url === title.poster ? 'poster' : 'backdrop',
            width: landscape ? (large ? 700 : 420) : large ? 380 : 280,
        } as const;
    });
    readonly label = computed(() => {
        const rank = this.rank();
        return rank ? `${rank}. ${this.title().title}` : this.title().title;
    });
    /** "ES · EN": one card for a title in both languages. */
    readonly languages = computed(() => languagesLabel(this.title()));
    /** "Series · Drama", under Apple TV's and Hulu's cards. */
    readonly typeKey = computed(() => titleTypeKey(this.title()));
    readonly genreKey = computed(() => {
        const genre = this.title().genres[0];
        return genre ? genreLabelKey(genre) : null;
    });
    /** The rating as Netflix's "% Match", 0–100. */
    readonly match = computed(() => {
        const rating = this.title().rating;
        return rating ? Math.round(rating * 10) : null;
    });
    /** The other looks' "★ 8.0". */
    readonly stars = computed(() => formatRating(this.title().rating));
    /** The synopsis the list or the title's page gave, never fetched here. */
    readonly plot = computed(
        () => this.title().plot ?? this.catalog.extrasOf(this.title())?.plot
    );

    open(): void {
        this.catalog.open(this.title());
    }

    artFailed(url: string): void {
        this.failed.update((failed) => new Set(failed).add(url));
    }
}
