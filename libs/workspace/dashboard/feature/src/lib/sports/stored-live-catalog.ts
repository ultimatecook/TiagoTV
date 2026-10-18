import { inject, Injectable } from '@angular/core';
import {
    XTREAM_DATA_SOURCE,
    XtreamApiService,
} from '@iptvnator/portal/xtream/data-access';
import {
    DatabaseService,
    ParentalLockService,
    RuntimeCapabilitiesService,
} from '@iptvnator/services';
import type { XtreamSourceCredentials } from '../xtream-source';
import {
    toLiveCatalog,
    type LiveCatalog,
    type StoredLiveStream,
} from './live-catalog';

/**
 * The live catalog the app already keeps for a playlist — the one its live
 * view reads — so the Home does not download the provider's whole line-up
 * a second time: SQLite (through the DB worker) in Electron, the session
 * cache in the browser build.
 */
@Injectable({ providedIn: 'root' })
export class StoredLiveCatalog {
    private readonly dataSource = inject(XTREAM_DATA_SOURCE);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly database = inject(DatabaseService);
    private readonly api = inject(XtreamApiService);
    private readonly parentalLock = inject(ParentalLockService);

    /** Changes when the categories a read withholds (parental lock) do. */
    readonly version = this.parentalLock.version;

    /**
     * The stored copy, or null while there is none (the live catalog was
     * never imported, or its import has not finished). Never contacts the
     * provider.
     */
    async read(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<LiveCatalog | null> {
        if (!(await this.isStored(playlistId))) {
            return null;
        }
        if (this.runtime.supportsXtreamSqliteDataSource) {
            const [categories, streams] = await Promise.all([
                this.dataSource.getCachedCategories(playlistId, 'live'),
                this.dataSource.getCachedContent(playlistId, 'live'),
            ]);
            return toLiveCatalog(categories, streams, true);
        }
        // The browser build keeps no database: its data source answers
        // from the session cache checked above.
        return this.readThroughDataSource(playlistId, credentials);
    }

    /**
     * First run, before the live catalog was ever stored: the whole
     * line-up, once. The browser build loads it through its data source,
     * whose session cache the live view then opens on. Electron's import
     * into SQLite belongs to the Xtream store's flow (import state,
     * cancellation, restore), so the Home only holds this copy in memory.
     */
    async download(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<LiveCatalog> {
        if (!this.runtime.supportsXtreamSqliteDataSource) {
            return this.readThroughDataSource(playlistId, credentials);
        }
        const options = { suppressErrorLog: true };
        const [categories, streams] = await Promise.all([
            this.api.getCategories(credentials, 'live', options),
            this.api.getLiveStreams(credentials, options),
        ]);
        return { categories, streams };
    }

    private async isStored(playlistId: string): Promise<boolean> {
        if (
            this.runtime.supportsXtreamSqliteDataSource &&
            (await this.database.getXtreamImportStatus(playlistId, 'live')) !==
                'completed'
        ) {
            return false;
        }
        const [categories, content] = await Promise.all([
            this.dataSource.hasCategories(playlistId, 'live'),
            this.dataSource.hasContent(playlistId, 'live'),
        ]);
        return categories && content;
    }

    private async readThroughDataSource(
        playlistId: string,
        credentials: XtreamSourceCredentials
    ): Promise<LiveCatalog> {
        const [categories, streams] = await Promise.all([
            this.dataSource.getCategories(playlistId, credentials, 'live'),
            this.dataSource.getContent(playlistId, credentials, 'live'),
        ]);
        return toLiveCatalog(categories, streams as StoredLiveStream[], false);
    }
}
