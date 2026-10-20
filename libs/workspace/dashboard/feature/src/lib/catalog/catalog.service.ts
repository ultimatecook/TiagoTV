import { computed, inject, Injectable, signal } from '@angular/core';
import type { DetailPlayMode } from '@iptvnator/portal/shared/util';
import { XtreamApiService } from '@iptvnator/portal/xtream/data-access';
import type { PlaylistMeta } from '@iptvnator/shared/interfaces';
import { PlatformsCatalogService } from '../platforms/platforms-catalog.service';
import { xtreamSourceCredentials } from '../xtream-source';
import { catalogExtras, type CatalogExtras } from './catalog-extras';
import { CatalogImport } from './catalog-import';
import { CatalogMembership } from './catalog-membership';
import { CatalogPlatformLists } from './catalog-platform-lists';
import { StoredVodCatalog } from './catalog-stored';
import {
    storedPlatformLists,
    withKnownGenres,
    type StoredVodCatalogData,
} from './catalog-stored-rows';
import {
    aggregateCatalog,
    type CatalogKind,
    type CatalogTitle,
    type PlatformTitleList,
} from './catalog-titles';

/** The stored copy changes with the app's imports, not by the minute. */
const FRESH_MS = 10 * 60 * 1000;
const OPTIONS = { suppressErrorLog: true };
/**
 * From the platforms' own lists, the page shows nothing until this many
 * platforms answered (or all, where fewer carry the kind): never one
 * platform's titles as if they were the whole catalog.
 */
export const MIN_ANSWERED_PLATFORMS = 3;

interface StoredCatalog {
    readonly playlistId: string;
    readonly lockVersion: number;
    readonly data: StoredVodCatalogData;
    readonly at: number;
}

export type CatalogStatus = 'no-source' | 'loading' | 'ready' | 'failed';

/**
 * Series / Películas: the titles of every platform the source carries,
 * one catalog per kind. Read from the catalog the app already stored
 * (`StoredVodCatalog`), so opening the page asks the provider nothing.
 * Where nothing is stored yet, Electron imports the kind first, as the
 * Xtream views would (`CatalogImport`), and reads it then; the browser
 * build, or a failed import, takes the platforms' own lists
 * (`CatalogPlatformLists`, the platforms taking turns), shown once several
 * platforms answered. The stored rows sit in one category each, so the
 * platforms' lists, refreshed in the background (`CatalogMembership`),
 * say which platforms carry them. A title's page is asked once, for the
 * hero.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
    private readonly platforms = inject(PlatformsCatalogService);
    private readonly stored = inject(StoredVodCatalog);
    private readonly importer = inject(CatalogImport);
    private readonly lists = inject(CatalogPlatformLists);
    private readonly membership = inject(CatalogMembership);
    private readonly api = inject(XtreamApiService);

    private readonly storedTitles = signal<
        ReadonlyMap<CatalogKind, StoredCatalog>
    >(new Map());
    /** The kinds read from the platforms' lists: nothing was stored. */
    private readonly fromPlatforms = signal<ReadonlySet<CatalogKind>>(
        new Set()
    );
    private readonly busy = signal<ReadonlySet<CatalogKind>>(new Set());
    /** The kinds waiting on their first import (Electron). */
    private readonly importing = signal<ReadonlySet<CatalogKind>>(new Set());
    private readonly requests = new Map<CatalogKind, Promise<void>>();
    private readonly storedReads = new Map<string, Promise<boolean>>();
    private readonly loadedExtras = signal<ReadonlyMap<string, CatalogExtras>>(
        new Map()
    );
    private readonly extrasRequested = new Set<string>();
    /** Drawn once a session: see `heroLead`. */
    private readonly lead = Math.floor(Math.random() * 1000);

    readonly source = this.platforms.source;
    private readonly views = {
        movie: computed(() => this.compute('movie')),
        series: computed(() => this.compute('series')),
    };

    /** The kind's titles, newest first, or null until some are known. */
    titles(kind: CatalogKind): readonly CatalogTitle[] | null {
        return this.views[kind]();
    }

    status(kind: CatalogKind): CatalogStatus {
        if (!this.source()) {
            return 'no-source';
        }
        if (this.titles(kind) !== null) {
            return 'ready';
        }
        return this.busy().has(kind) || !this.failed(kind)
            ? 'loading'
            : 'failed';
    }

    /**
     * Whether the kind is still loading because the app is importing it
     * for the first time: "Preparando tu catálogo…", which takes longer.
     */
    preparing(kind: CatalogKind): boolean {
        return this.importing().has(kind) && this.titles(kind) === null;
    }

    load(kind: CatalogKind): Promise<void> {
        const source = this.source();
        if (!source || this.isFresh(kind, source._id)) {
            return Promise.resolve();
        }
        let request = this.requests.get(kind);
        if (!request) {
            request = this.read(kind, source).finally(() => {
                this.requests.delete(kind);
                this.busy.update((kinds) => without(kinds, kind));
            });
            this.requests.set(kind, request);
        }
        return request;
    }

    /**
     * The stored copy alone, never an import or the platforms' lists, so
     * it asks the provider nothing and does not wait for them: the Home's
     * hero features the catalog's titles when the app keeps them (or once
     * a section's import stored them), and leaves the rest to the sections
     * that load.
     */
    loadStored(kind: CatalogKind): Promise<void> {
        const source = this.source();
        if (!source || this.isFresh(kind, source._id)) {
            return Promise.resolve();
        }
        return this.readStoredOnce(kind, source).then(() => undefined);
    }

    /**
     * Which platform leads "Novedades", and so features in the hero: drawn
     * once a session, so the hero is not always the same platform's, and
     * stays put for the session (its page is asked once, not each visit).
     */
    heroLead(): number {
        return this.lead;
    }

    /** The hero title's page, once fetched. */
    extrasOf(title: CatalogTitle): CatalogExtras | null {
        const source = this.source();
        return source
            ? (this.loadedExtras().get(extrasKey(source._id, title)) ?? null)
            : null;
    }

    /** Fetches a hero title's page (backdrop, length), once per title. */
    loadExtras(title: CatalogTitle): void {
        const source = this.source();
        if (!source) {
            return;
        }
        const key = extrasKey(source._id, title);
        if (this.extrasRequested.has(key)) {
            return;
        }
        this.extrasRequested.add(key);
        const credentials = xtreamSourceCredentials(source);
        const details =
            title.kind === 'movie'
                ? this.api.getVodInfo(credentials, title.id, OPTIONS)
                : this.api.getSeriesInfo(credentials, title.id, OPTIONS);
        void details
            .then((answer) =>
                this.loadedExtras.update((state) =>
                    new Map(state).set(key, catalogExtras(answer))
                )
            )
            .catch(() => this.extrasRequested.delete(key));
    }

    /** Opens the title's page, as the platform pages do. */
    open(title: CatalogTitle): void {
        this.platforms.open(title);
    }

    /** Opens the title's page playing it: the movie, or an episode. */
    play(title: CatalogTitle, mode: DetailPlayMode): void {
        this.platforms.play(title, mode);
    }

    private compute(kind: CatalogKind): readonly CatalogTitle[] | null {
        const source = this.source();
        if (!source) {
            return null;
        }
        const stored = this.storedTitles().get(kind);
        if (stored?.playlistId === source._id) {
            return aggregateCatalog(this.storedLists(kind, stored.data), kind);
        }
        // While the import runs, lists the platform pages already loaded
        // may show, on the same terms; nothing is asked for them.
        if (!this.fromPlatforms().has(kind) && !this.importing().has(kind)) {
            return null;
        }
        const view = this.lists.view(kind);
        const busy = this.busy().has(kind);
        if (
            busy &&
            view.answered < Math.min(MIN_ANSWERED_PLATFORMS, view.total)
        ) {
            return null;
        }
        const titles = aggregateCatalog(view.lists, kind);
        // None yet: the platforms are still loading, failed, or carry none.
        return titles.length > 0 || (!busy && !this.failed(kind))
            ? titles
            : null;
    }

    private failed(kind: CatalogKind): boolean {
        return (
            this.platforms.failed() ||
            (this.fromPlatforms().has(kind) && this.lists.view(kind).failed > 0)
        );
    }

    private async read(kind: CatalogKind, source: PlaylistMeta): Promise<void> {
        this.busy.update((kinds) => new Set(kinds).add(kind));
        if (await this.readStoredOnce(kind, source)) {
            void this.membership.refresh(kind);
            return;
        }
        this.storedTitles.update((state) => {
            const next = new Map(state);
            next.delete(kind);
            return next;
        });
        if (this.importer.supported) {
            this.importing.update((kinds) => new Set(kinds).add(kind));
            try {
                const imported = await this.importer.ensure(
                    source._id,
                    xtreamSourceCredentials(source),
                    kind
                );
                if (imported && (await this.readStored(kind, source))) {
                    void this.membership.refresh(kind);
                    return;
                }
            } finally {
                this.importing.update((kinds) => without(kinds, kind));
            }
        }
        // Not stored and not imported: the platforms' lists, in turns.
        this.fromPlatforms.update((kinds) => new Set(kinds).add(kind));
        await this.lists.load(kind);
    }

    /** One stored read of the kind at a time, shared by its callers. */
    private readStoredOnce(
        kind: CatalogKind,
        source: PlaylistMeta
    ): Promise<boolean> {
        const key = `${source._id}:${kind}`;
        let read = this.storedReads.get(key);
        if (!read) {
            read = this.readStored(kind, source).finally(() =>
                this.storedReads.delete(key)
            );
            this.storedReads.set(key, read);
        }
        return read;
    }

    /** Whether the stored copy had titles of the kind, now kept. */
    private async readStored(
        kind: CatalogKind,
        source: PlaylistMeta
    ): Promise<boolean> {
        const credentials = xtreamSourceCredentials(source);
        const data = await this.stored
            .read(source._id, credentials, kind)
            .catch(() => null);
        if (
            !data ||
            this.storedLists(kind, data).every((list) => !list.titles.length)
        ) {
            return false;
        }
        this.storedTitles.update((state) =>
            new Map(state).set(kind, {
                playlistId: source._id,
                lockVersion: this.stored.version(),
                data,
                at: Date.now(),
            })
        );
        return true;
    }

    /**
     * The stored titles per platform: in the platforms their own lists
     * file them in too, with the genres the platform pages already know.
     */
    private storedLists(
        kind: CatalogKind,
        data: StoredVodCatalogData
    ): PlatformTitleList[] {
        return withKnownGenres(
            storedPlatformLists(data, kind, this.membership.members(kind)),
            (list) => this.platforms.titlesOf(list.platform.id)
        );
    }

    private isFresh(kind: CatalogKind, playlistId: string): boolean {
        const stored = this.storedTitles().get(kind);
        return (
            stored?.playlistId === playlistId &&
            stored.lockVersion === this.stored.version() &&
            Date.now() - stored.at < FRESH_MS
        );
    }
}

function extrasKey(playlistId: string, title: CatalogTitle): string {
    return `${playlistId}:${title.kind}:${title.id}`;
}

function without<T>(set: ReadonlySet<T>, item: T): ReadonlySet<T> {
    const next = new Set(set);
    next.delete(item);
    return next;
}
