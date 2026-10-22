import {
    computed,
    effect,
    inject,
    Injectable,
    signal,
    untracked,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import { RuntimeCapabilitiesService } from '@iptvnator/services';
import { LazySnackBar } from '@iptvnator/services/lazy-snack-bar';
import { SportsCatalogService } from '../sports/sports-catalog.service';

interface SavedStreams {
    readonly playlistId: string | null;
    readonly streams: ReadonlySet<number>;
}

const NONE: SavedStreams = { playlistId: null, streams: new Set() };

/**
 * Mi lista's live channels on "En vivo" and a competition's page: the
 * source's favourites, the very rows the Xtream live view's star writes and
 * Mi lista reads (SQLite in Electron, the browser's user data otherwise),
 * kept against the stored catalog's row as that star keeps them. A
 * favourite is one stream ("|ES| La 1 ᴴᴰ"); a tile of several copies is on
 * the list when any of them is. Read again as a page opens: Mi lista or the
 * live view may have changed it since.
 */
@Injectable({ providedIn: 'root' })
export class ChannelFavoritesService {
    private readonly sports = inject(SportsCatalogService);
    private readonly dataSource = inject(XTREAM_DATA_SOURCE);
    private readonly runtime = inject(RuntimeCapabilitiesService);
    private readonly snackBar = inject(LazySnackBar);
    private readonly translate = inject(TranslateService);
    private readonly saved = signal<SavedStreams>(NONE);
    private loads = 0;
    private writing = 0;

    constructor() {
        // Another source: its own list.
        const sourceId = computed(() => this.sports.source()?._id ?? null);
        effect(() => {
            sourceId();
            untracked(() => void this.refresh());
        });
    }

    /** Whether the stream, or any of the streams, is on the list. */
    has(streams: number | readonly number[]): boolean {
        const { playlistId, streams: saved } = this.saved();
        if (playlistId !== (this.sports.source()?._id ?? null)) {
            return false;
        }
        return typeof streams === 'number'
            ? saved.has(streams)
            : streams.some((stream) => saved.has(stream));
    }

    /** Reads the source's list again. */
    async refresh(): Promise<void> {
        const load = ++this.loads;
        const playlistId = this.sports.source()?._id ?? null;
        if (!playlistId) {
            this.saved.set(NONE);
            return;
        }
        try {
            const rows = await this.dataSource.getFavorites(playlistId);
            if (load === this.loads) {
                const live = rows.filter((row) => row.type === 'live');
                this.saved.set({
                    playlistId,
                    streams: new Set(live.map((row) => Number(row.xtream_id))),
                });
            }
        } catch {
            // The list stays as last read.
        }
    }

    /**
     * Adds `stream` to the list or, when any of `copies` (the tile's
     * streams, `stream` among them) is on it, takes those off. Answers the
     * new state, or null when it could not be written (a channel the app
     * has not stored yet, a failed write: the heart goes back, a toast says
     * so).
     */
    async toggle(
        stream: number,
        copies: readonly number[] = [stream]
    ): Promise<boolean | null> {
        const playlistId = this.sports.source()?._id;
        if (!playlistId) {
            return null;
        }
        const onList = copies.filter((copy) => this.has(copy));
        const adding = onList.length === 0;
        const changed = adding ? [stream] : onList;
        this.mark(playlistId, changed, adding);
        // A read in flight would put back the list as it was: the list is
        // read again once the writes are done.
        this.loads++;
        this.writing++;
        try {
            for (const copy of changed) {
                await this.write(playlistId, copy, adding);
            }
            return adding;
        } catch {
            this.mark(playlistId, changed, !adding);
            void this.snackBar.open(
                this.translate.instant('WORKSPACE.MY_LIST.SAVE_FAILED'),
                undefined,
                { duration: 6000 }
            );
            return null;
        } finally {
            if (--this.writing === 0) {
                void this.refresh();
            }
        }
    }

    private async write(
        playlistId: string,
        streamId: number,
        add: boolean
    ): Promise<void> {
        // The stored catalog's row, as the live view's star resolves it;
        // the browser build keys its favourites by the stream itself.
        const content = await this.dataSource.getContentByXtreamId(
            streamId,
            playlistId,
            'live'
        );
        const id =
            content?.id ??
            (this.runtime.supportsXtreamSqliteDataSource ? null : streamId);
        if (id == null) {
            throw new Error('The channel is not in the stored catalog');
        }
        const target = { id: Number(id), type: 'live' as const };
        if (add) {
            await this.dataSource.addFavorite(target, playlistId);
        } else {
            await this.dataSource.removeFavorite(target, playlistId);
        }
    }

    private mark(
        playlistId: string,
        streams: readonly number[],
        saved: boolean
    ): void {
        this.saved.update((current) => {
            const next = new Set(
                current.playlistId === playlistId ? current.streams : []
            );
            for (const stream of streams) {
                if (saved) {
                    next.add(stream);
                } else {
                    next.delete(stream);
                }
            }
            return { playlistId, streams: next };
        });
    }
}
