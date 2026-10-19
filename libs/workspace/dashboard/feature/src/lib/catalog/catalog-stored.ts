import { inject, Injectable } from '@angular/core';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import {
    DatabaseService,
    ParentalLockService,
    RuntimeCapabilitiesService,
} from '@iptvnator/services';
import type { XtreamSourceCredentials } from '../xtream-source';
import {
    toStoredVodCatalog,
    type StoredVodCatalogData,
    type StoredVodRow,
} from './catalog-stored-rows';
import type { CatalogKind } from './catalog-titles';

/**
 * The movies or series the app already keeps for a playlist — the copy its
 * own Movies and Series views read — so the catalog page does not ask the
 * provider for each platform's lists: SQLite (through the DB worker) in
 * Electron once its import completed, the session cache in the browser
 * build once a view loaded it. Never downloads the catalog itself.
 */
@Injectable({ providedIn: 'root' })
export class StoredVodCatalog {
    private readonly dataSource = inject(XTREAM_DATA_SOURCE);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly database = inject(DatabaseService);

    /** Changes when the categories a read withholds (parental lock) do. */
    readonly version = inject(ParentalLockService).version;

    /** The stored copy, or null while there is none. */
    async read(
        playlistId: string,
        credentials: XtreamSourceCredentials,
        kind: CatalogKind
    ): Promise<StoredVodCatalogData | null> {
        const categoryType = kind === 'movie' ? 'vod' : 'series';
        if (this.runtime.supportsXtreamSqliteDataSource) {
            if (
                (await this.database.getXtreamImportStatus(
                    playlistId,
                    kind
                )) !== 'completed' ||
                !(await this.dataSource.hasContent(playlistId, kind))
            ) {
                return null;
            }
            const [categories, rows] = await Promise.all([
                this.dataSource.getCachedCategories(playlistId, categoryType),
                this.dataSource.getCachedContent(playlistId, kind),
            ]);
            return toStoredVodCatalog(
                categories,
                rows as readonly StoredVodRow[],
                true
            );
        }
        // The browser build keeps no database: its data source answers from
        // the session cache, and only once the catalog is in it.
        if (!(await this.dataSource.hasContent(playlistId, kind))) {
            return null;
        }
        const [categories, rows] = await Promise.all([
            this.dataSource.getCategories(
                playlistId,
                credentials,
                categoryType
            ),
            this.dataSource.getContent(playlistId, credentials, kind),
        ]);
        return toStoredVodCatalog(
            categories,
            rows as readonly StoredVodRow[],
            false
        );
    }
}
