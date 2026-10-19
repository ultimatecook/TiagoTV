import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { titleKey } from '../../platforms/platform-titles';
import { PlatformLogoComponent } from '../../platforms/ui/platform-logo.component';
import { heroMeta } from '../catalog-meta';
import type { CatalogKind, CatalogTitle } from '../catalog-titles';
import { CatalogService } from '../catalog.service';
import { CatalogStripComponent } from './catalog-strip.component';

let nextId = 0;

/**
 * The catalog page's cinematic hero, behind the top bar: the section's
 * name, the featured title (its platform, name, kind · year · genres ·
 * length, Reproducir and Más info, both opening its page) and, on the
 * hero's lower edge, "Novedades": picking one of them features it, the
 * page stays put. The artwork is the title's backdrop, else its poster at
 * the right, over the platform's colour.
 */
@Component({
    selector: 'lib-catalog-hero',
    imports: [
        CatalogStripComponent,
        MatIcon,
        PlatformLogoComponent,
        TranslatePipe,
    ],
    templateUrl: './catalog-hero.component.html',
    styleUrl: './catalog-hero.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogHeroComponent {
    private readonly catalog = inject(CatalogService);

    readonly kind = input.required<CatalogKind>();
    readonly releases = input.required<readonly CatalogTitle[]>();
    readonly featured = input.required<CatalogTitle | null>();
    readonly picked = output<CatalogTitle>();

    readonly headingId = `catalog-hero-${nextId}`;
    readonly releasesId = `catalog-releases-${nextId++}`;
    readonly headingKey = computed(() =>
        this.kind() === 'movie'
            ? 'WORKSPACE.CATALOG.MOVIES'
            : 'WORKSPACE.CATALOG.SERIES'
    );
    readonly featuredKey = computed(() => {
        const title = this.featured();
        return title ? titleKey(title) : null;
    });
    private readonly extras = computed(() => {
        const title = this.featured();
        return title ? this.catalog.extrasOf(title) : null;
    });
    readonly meta = computed(() => {
        const title = this.featured();
        return title ? heroMeta(title, this.extras()) : [];
    });

    private readonly failed = signal<ReadonlySet<string>>(new Set());
    /** The backdrop across the hero, else the poster at its right. */
    readonly art = computed(() => {
        const title = this.featured();
        if (!title) {
            return null;
        }
        const failed = this.failed();
        const backdrop = title.backdrop ?? this.extras()?.backdrop ?? null;
        if (backdrop && !failed.has(backdrop)) {
            return { url: backdrop, poster: false };
        }
        return title.poster && !failed.has(title.poster)
            ? { url: title.poster, poster: true }
            : null;
    });

    readonly key = titleKey;

    /** A card's 16:9 artwork: its backdrop, else its poster cropped. */
    cardArt(title: CatalogTitle): string | null {
        const failed = this.failed();
        return (
            [title.backdrop, title.poster].find(
                (url): url is string => !!url && !failed.has(url)
            ) ?? null
        );
    }

    artFailed(url: string): void {
        this.failed.update((failed) => new Set(failed).add(url));
    }

    open(title: CatalogTitle): void {
        this.catalog.open(title);
    }
}
