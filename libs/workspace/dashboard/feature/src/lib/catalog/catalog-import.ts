import { inject, Injectable } from '@angular/core';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import {
    DatabaseService,
    ParentalLockService,
    RuntimeCapabilitiesService,
    SourceActivityService,
    XtreamPendingRestoreService,
} from '@iptvnator/services';
import type { XtreamSourceCredentials } from '../xtream-source';
import { CatalogRequestLog } from './catalog-request-log';
import { CatalogRequests, delay } from './catalog-requests';
import type { CatalogKind } from './catalog-titles';

/** While another flow works on the source, it is checked this often. */
export const CATALOG_IMPORT_POLL_MS = 2_000;
/** How long the catalog waits for that flow before it gives up. */
export const CATALOG_IMPORT_WAIT_MS = 10 * 60 * 1000;
/** A refused import is tried once more this much later. */
export const CATALOG_IMPORT_RETRY_MS = 20_000;

/**
 * First run in Electron: Series / Películas (and the Home's Top 10 and
 * "Series para vos") have no stored catalog until the kind is imported,
 * and the redesign opens no Xtream Movies/Series view that would import
 * it. This runs the app's own import of that one kind — the data source's
 * `getCategories` and `getContent`, two requests for the whole catalog
 * instead of one per platform category, saved by the DB worker — and
 * records it as the Xtream store does (`completed`, or `failed` with the
 * partial rows cleared), so `StoredVodCatalog` reads it from then on.
 *
 * It never runs beside other work on the source (`SourceActivityService`:
 * the Xtream store's own import, a refresh, a removal); it waits for it
 * and reads what it stored. It leaves a cancelled import cancelled, and a
 * pending backup restore to the Xtream store's flow, which replays it.
 * Imports queue one at a time (`CatalogRequests`).
 */
@Injectable({ providedIn: 'root' })
export class CatalogImport {
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly database = inject(DatabaseService);
    private readonly dataSource = inject(XTREAM_DATA_SOURCE);
    private readonly activity = inject(SourceActivityService);
    private readonly pendingRestore = inject(XtreamPendingRestoreService);
    private readonly parentalLock = inject(ParentalLockService);
    private readonly requests = inject(CatalogRequests);
    private readonly log = inject(CatalogRequestLog);

    private readonly running = new Map<string, Promise<boolean>>();
    /** Kinds whose import failed this session: the fallback serves them. */
    private readonly failed = new Set<string>();

    /** Whether this runtime keeps an imported catalog (Electron's SQLite). */
    get supported(): boolean {
        return this.runtime.supportsXtreamSqliteDataSource;
    }

    /**
     * Resolves true once the kind's import has completed (now, earlier, or
     * by the flow it waited for), false when it cannot be imported here.
     */
    ensure(
        playlistId: string,
        credentials: XtreamSourceCredentials,
        kind: CatalogKind
    ): Promise<boolean> {
        if (!this.supported) {
            return Promise.resolve(false);
        }
        const key = `${playlistId}:${kind}`;
        let request = this.running.get(key);
        if (!request) {
            request = this.requests
                .run(() => this.importOnce(key, playlistId, credentials, kind))
                .catch(() => false)
                .finally(() => this.running.delete(key));
            this.running.set(key, request);
        }
        return request;
    }

    private async importOnce(
        key: string,
        playlistId: string,
        credentials: XtreamSourceCredentials,
        kind: CatalogKind
    ): Promise<boolean> {
        if (!(await this.settled(playlistId))) {
            return false;
        }
        const status = await this.database.getXtreamImportStatus(
            playlistId,
            kind
        );
        if (status === 'completed') {
            return true;
        }
        if (
            status === 'cancelled' ||
            this.failed.has(key) ||
            this.restorePending(playlistId)
        ) {
            return false;
        }
        const release = this.activity.begin([playlistId]);
        try {
            await this.download(playlistId, credentials, kind);
            if (!(await this.dataSource.hasContent(playlistId, kind))) {
                throw new Error('The provider listed nothing.');
            }
            await this.database.setXtreamImportStatus(
                playlistId,
                kind,
                'completed'
            );
            return true;
        } catch {
            this.failed.add(key);
            await this.database
                .setXtreamImportStatus(playlistId, kind, 'failed')
                .catch(() => false);
            await this.database
                .clearXtreamImportCache(playlistId, kind)
                .catch(() => false);
            return false;
        } finally {
            release();
        }
    }

    /** The categories first: the content's rows point at their DB rows. */
    private async download(
        playlistId: string,
        credentials: XtreamSourceCredentials,
        kind: CatalogKind
    ): Promise<void> {
        const categoryType = kind === 'movie' ? 'vod' : 'series';
        for (let attempt = 0; ; attempt++) {
            try {
                await this.log.track(
                    `get_${categoryType}_categories`,
                    null,
                    () =>
                        this.dataSource.getCategories(
                            playlistId,
                            credentials,
                            categoryType
                        )
                );
                await this.log.track(
                    kind === 'movie' ? 'get_vod_streams' : 'get_series',
                    null,
                    () =>
                        this.dataSource.getContent(
                            playlistId,
                            credentials,
                            kind
                        )
                );
                return;
            } catch (error) {
                if (attempt > 0) {
                    throw error;
                }
                await delay(CATALOG_IMPORT_RETRY_MS);
            }
        }
    }

    /**
     * Waits while another flow works on the source, or while the parental
     * lock withholds every row (a read would import nothing); false when
     * that lasts longer than `CATALOG_IMPORT_WAIT_MS`.
     */
    private async settled(playlistId: string): Promise<boolean> {
        const busy = () =>
            this.activity.isBusy(playlistId) ||
            !!this.parentalLock.withholdsEverything?.();
        const until = Date.now() + CATALOG_IMPORT_WAIT_MS;
        while (busy()) {
            if (Date.now() >= until) {
                return false;
            }
            await delay(CATALOG_IMPORT_POLL_MS);
        }
        return true;
    }

    /** Unreadable restore state counts as pending: fail closed. */
    private restorePending(playlistId: string): boolean {
        try {
            return this.pendingRestore.getOrThrow(playlistId) !== null;
        } catch {
            return true;
        }
    }
}
