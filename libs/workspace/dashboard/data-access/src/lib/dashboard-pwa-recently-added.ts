import type { IXtreamDataSource } from '@iptvnator/portal/xtream/data-access';
import {
    toXtreamRecentlyAddedTimestamp,
    type PlaylistMeta,
    type PortalAddedItem,
} from '@iptvnator/shared/interfaces';

/** Sources the browser build scans: catalogs are fetched whole there. */
const PWA_RECENTLY_ADDED_PLAYLIST_LIMIT = 3;

interface CatalogRow {
    readonly added?: string | number;
    readonly last_modified?: string | number;
    readonly category_id?: string | number;
    readonly name?: string;
    readonly title?: string;
    readonly stream_id?: number;
    readonly series_id?: number;
    readonly xtream_id?: number;
    readonly stream_icon?: string;
    readonly cover?: string;
    readonly poster_url?: string;
    readonly backdrop_path?: readonly string[] | string | null;
    readonly rating?: string | number;
    readonly genre?: string;
    readonly plot?: string;
}

/**
 * The browser build has no SQLite catalog to ask for its newest titles, so
 * the Home rails would stay empty there. The Xtream catalogs themselves
 * carry the dates: movies their `added`, series their `last_modified`. The
 * data source answers from its session cache once a catalog was opened, so
 * this costs one request per catalog at most.
 */
export async function loadPwaXtreamRecentlyAdded(
    dataSource: IXtreamDataSource,
    playlists: readonly PlaylistMeta[],
    limit: number,
    nowMs = Date.now()
): Promise<PortalAddedItem[]> {
    const sources = playlists
        .filter((p) => p.serverUrl && p.username && p.password)
        .slice(0, PWA_RECENTLY_ADDED_PLAYLIST_LIMIT);

    const requests: Promise<PortalAddedItem[]>[] = [];
    for (const playlist of sources) {
        for (const type of ['movie', 'series'] as const) {
            requests.push(loadCatalog(dataSource, playlist, type, nowMs));
        }
    }

    const items: PortalAddedItem[] = [];
    for (const batch of await Promise.all(requests)) {
        items.push(...batch);
    }
    return items
        .sort((a, b) => Date.parse(b.added_at) - Date.parse(a.added_at))
        .slice(0, limit);
}

async function loadCatalog(
    dataSource: IXtreamDataSource,
    playlist: PlaylistMeta,
    type: 'movie' | 'series',
    nowMs: number
): Promise<PortalAddedItem[]> {
    try {
        const rows = (await dataSource.getContent(
            playlist._id,
            {
                serverUrl: playlist.serverUrl as string,
                username: playlist.username as string,
                password: playlist.password as string,
            },
            type
        )) as unknown as CatalogRow[];
        return rows
            .map((row) => toAddedItem(row, type, playlist, nowMs))
            .filter((item): item is PortalAddedItem => !!item);
    } catch {
        // An unreachable catalog only drops its titles from the rail.
        return [];
    }
}

function toAddedItem(
    row: CatalogRow,
    type: 'movie' | 'series',
    playlist: PlaylistMeta,
    nowMs: number
): PortalAddedItem | null {
    const id =
        type === 'movie'
            ? (row.stream_id ?? row.xtream_id)
            : (row.series_id ?? row.xtream_id);
    const [primary, fallback] =
        type === 'movie'
            ? [row.added, row.last_modified]
            : [row.last_modified, row.added];
    const addedMs =
        toXtreamRecentlyAddedTimestamp(primary, nowMs) ||
        toXtreamRecentlyAddedTimestamp(fallback, nowMs);
    if (id === undefined || id === null || addedMs <= 0) {
        return null;
    }

    const backdrop = Array.isArray(row.backdrop_path)
        ? row.backdrop_path[0]
        : row.backdrop_path;
    return {
        id,
        title: row.name ?? row.title ?? '',
        type,
        playlist_id: playlist._id,
        playlist_name: playlist.title,
        added_at: new Date(addedMs).toISOString(),
        category_id: row.category_id ?? '',
        xtream_id: id,
        poster_url:
            (type === 'movie' ? row.stream_icon : row.cover) ??
            row.poster_url ??
            undefined,
        ...(backdrop ? { backdrop_url: backdrop } : {}),
        ...(row.rating ? { rating: String(row.rating) } : {}),
        ...(row.genre ? { genre: row.genre } : {}),
        ...(row.plot ? { plot: row.plot } : {}),
        source: 'xtream',
    };
}
