import { computed, inject, Injectable } from '@angular/core';
import { TitlePlatformStore } from '@iptvnator/services';
import { CatalogService } from '../catalog/catalog.service';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { indexTitleVersions, titleLanguageVersions } from './title-versions';

/**
 * The language versions of the title on screen (`TitlePlatformStore`), as
 * Series / Películas merge them: its page offers the other language as a
 * second choice next to the one the catalog opened (English, the original,
 * unless the user chose the Spanish dub). It only reads what the catalog
 * already holds and asks the provider nothing.
 */
@Injectable({ providedIn: 'root' })
export class TitleVersionsService {
    private readonly store = inject(TitlePlatformStore);
    private readonly catalog = inject(CatalogService);
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly index = {
        movie: computed(() => indexTitleVersions(this.catalog.titles('movie'))),
        series: computed(() =>
            indexTitleVersions(this.catalog.titles('series'))
        ),
    };
    private started = false;

    /** Starts answering the title pages; calling it again does nothing. */
    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        this.store.useVersionsResolver((ref) => {
            const id = Number(ref.itemId);
            if (ref.playlistId !== this.platforms.source()?._id) {
                return [];
            }
            const title = this.index[ref.kind]().get(id);
            return title
                ? titleLanguageVersions(title, id, (shown, version) =>
                      this.platforms.open(shown, version)
                  )
                : [];
        });
    }
}
