import {
    effect,
    inject,
    Injectable,
    Injector,
    untracked,
    type EffectRef,
} from '@angular/core';
import type { CatalogExtras } from '../catalog/catalog-extras';
import type { CatalogTitle } from '../catalog/catalog-titles';
import { CatalogService } from '../catalog/catalog.service';

/** How long a title page may take before the next one is asked. */
export const TITLE_PAGE_WAIT_MS = 8000;

/**
 * The title pages the Home asks for (get_vod_info / get_series_info, via
 * `CatalogService.loadExtras`, which keeps them for the whole app): one at
 * a time, in the order asked. The provider allows one connection and slows
 * down under parallel requests; the hero's backdrops and "Series para vos"
 * used to ask theirs at once.
 */
@Injectable({ providedIn: 'root' })
export class HomeTitlePagesService {
    private readonly catalog = inject(CatalogService);
    private readonly injector = inject(Injector);
    private queue: Promise<unknown> = Promise.resolve();

    /** The title's page: now when known, else after the ones asked first. */
    fetch(title: CatalogTitle): Promise<CatalogExtras | null> {
        const known = this.catalog.extrasOf(title);
        if (known) {
            return Promise.resolve(known);
        }
        const answer = this.queue.then(() => this.ask(title));
        this.queue = answer.catch(() => null);
        return answer;
    }

    private ask(title: CatalogTitle): Promise<CatalogExtras | null> {
        // Asked meanwhile by another section, or by an earlier turn.
        const known = this.catalog.extrasOf(title);
        if (known) {
            return Promise.resolve(known);
        }
        this.catalog.loadExtras(title);
        return new Promise((resolve) => {
            let watcher: EffectRef | null = null;
            let settled = false;
            const finish = (extras: CatalogExtras | null) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                watcher?.destroy();
                resolve(extras);
            };
            // A failed request leaves no page: give up after a while.
            const timer = setTimeout(() => finish(null), TITLE_PAGE_WAIT_MS);
            watcher = effect(
                () => {
                    const extras = this.catalog.extrasOf(title);
                    if (extras) {
                        untracked(() => finish(extras));
                    }
                },
                { injector: this.injector }
            );
            if (settled) {
                watcher.destroy();
            }
        });
    }
}
