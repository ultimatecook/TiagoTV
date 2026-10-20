import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    input,
    signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { genreLabelKey } from '../../platforms/platform-genres';
import { titleKey } from '../../platforms/platform-titles';
import { PlatformLogoComponent } from '../../platforms/ui/platform-logo.component';
import { SharpImagePipe } from '../../sharp-image.pipe';
import { posterMeta } from '../catalog-meta';
import type { CatalogRow, CatalogTitle } from '../catalog-titles';
import { CatalogService } from '../catalog.service';
import { CatalogStripComponent } from './catalog-strip.component';

let nextId = 0;
/** How far below (or above) the view a row starts rendering its posters. */
const NEAR_MARGIN = '900px';

/**
 * A genre's row of the catalog page (or a platform's, where the catalog
 * names no genres): 2:3 posters with the platform's logo and the title on
 * them and the year, another genre and the rating under them; each opens
 * the title's page. Its posters render once the row nears the view.
 */
@Component({
    selector: 'lib-catalog-row',
    imports: [
        CatalogStripComponent,
        PlatformLogoComponent,
        SharpImagePipe,
        TranslatePipe,
    ],
    templateUrl: './catalog-row.component.html',
    styleUrl: './catalog-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogRowComponent {
    private readonly catalog = inject(CatalogService);

    readonly row = input.required<CatalogRow>();

    readonly headingId = `catalog-row-${nextId++}`;
    readonly rendered = signal(false);
    readonly label = computed(() => {
        const row = this.row();
        return row.genre
            ? { key: genreLabelKey(row.genre), params: undefined }
            : {
                  key: 'WORKSPACE.CATALOG.ON_PLATFORM',
                  params: { platform: row.platform?.name ?? '' },
              };
    });
    private readonly failed = signal<ReadonlySet<string>>(new Set());

    readonly key = titleKey;

    constructor() {
        const host: HTMLElement = inject(ElementRef).nativeElement;
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            if (typeof IntersectionObserver === 'undefined') {
                this.rendered.set(true);
                return;
            }
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        observer.disconnect();
                        this.rendered.set(true);
                    }
                },
                { root: scroller(host), rootMargin: `${NEAR_MARGIN} 0px` }
            );
            observer.observe(host);
            destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    metaOf(title: CatalogTitle) {
        return posterMeta(title, this.row().genre);
    }

    posterOf(title: CatalogTitle): string | null {
        const failed = this.failed();
        return (
            [title.poster, title.backdrop].find(
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

/** The page's scroller: the nearest ancestor that scrolls vertically. */
function scroller(element: HTMLElement): HTMLElement | null {
    for (
        let parent = element.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
    ) {
        const overflow = getComputedStyle(parent).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
            return parent;
        }
    }
    return null;
}
