import { getJson, type JsonRequest } from '../core/http';
import { serial } from '../core/request-queue';
import { parseAccount, type AccountInfo } from './account';

/**
 * The provider's Xtream API (`player_api.php`), asked one category at a
 * time: a 2019 TV must never parse a whole VOD catalog at once. Catalog
 * requests go through the serial queue (core/request-queue.ts); the
 * account and the programme guide, which the player asks for, do not.
 */
export interface XtreamCredentials {
    readonly server: string;
    readonly username: string;
    readonly password: string;
}

export type CatalogKind = 'live' | 'vod' | 'series';

export interface XtreamCategory {
    readonly category_id: string | number;
    readonly category_name: string;
}

export interface XtreamLiveStream {
    readonly stream_id: number | string;
    readonly name: string;
    readonly stream_icon?: string | null;
    readonly category_id: string | number | null;
    readonly is_adult?: number | string | null;
    readonly added?: number | string | null;
    readonly epg_channel_id?: string | null;
}

export interface XtreamEpgListing {
    readonly title?: string;
    readonly start_timestamp?: string | number;
    readonly stop_timestamp?: string | number;
}

const CATEGORY_ACTION: Readonly<Record<CatalogKind, string>> = {
    live: 'get_live_categories',
    vod: 'get_vod_categories',
    series: 'get_series_categories',
};

const STREAMS_ACTION: Readonly<Record<CatalogKind, string>> = {
    live: 'get_live_streams',
    vod: 'get_vod_streams',
    series: 'get_series',
};

function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

export class XtreamClient {
    private readonly queued: (url: string, timeoutMs?: number, background?: boolean) => Promise<unknown>;

    constructor(
        readonly credentials: XtreamCredentials,
        private readonly request: JsonRequest = getJson
    ) {
        this.queued = (url, timeoutMs, background = false) =>
            serial(() => request(url, timeoutMs), background);
    }

    /** The values `redact` must hide wherever this client's URLs show. */
    get secrets(): readonly string[] {
        return [this.credentials.username, this.credentials.password];
    }

    apiUrl(params: Readonly<Record<string, string | number>> = {}): string {
        const { server, username, password } = this.credentials;
        const query = [
            `username=${encodeURIComponent(username)}`,
            `password=${encodeURIComponent(password)}`,
        ];
        for (const key of Object.keys(params)) {
            query.push(`${key}=${encodeURIComponent(String(params[key]))}`);
        }
        return `${server}/player_api.php?${query.join('&')}`;
    }

    async account(): Promise<AccountInfo> {
        return parseAccount(await this.request(this.apiUrl(), 12000));
    }

    async categories(kind: CatalogKind): Promise<XtreamCategory[]> {
        const list = asArray<XtreamCategory>(
            await this.queued(this.apiUrl({ action: CATEGORY_ACTION[kind] }))
        );
        return list.filter(
            (category) =>
                category &&
                category.category_id !== undefined &&
                typeof category.category_name === 'string'
        );
    }

    /** A category's entries; `background` lets the viewer's requests go first. */
    async streams<T = XtreamLiveStream>(
        kind: CatalogKind,
        categoryId: string | number,
        background = false
    ): Promise<T[]> {
        return asArray<T>(
            await this.queued(
                this.apiUrl({
                    action: STREAMS_ACTION[kind],
                    category_id: categoryId,
                }),
                30000,
                background
            )
        );
    }

    vodInfo(id: number, background = false): Promise<unknown> {
        return this.queued(this.apiUrl({ action: 'get_vod_info', vod_id: id }), undefined, background);
    }

    seriesInfo(id: number, background = false): Promise<unknown> {
        return this.queued(this.apiUrl({ action: 'get_series_info', series_id: id }), undefined, background);
    }

    async shortEpg(streamId: number, limit = 2): Promise<XtreamEpgListing[]> {
        const answer = await this.request(
            this.apiUrl({ action: 'get_short_epg', stream_id: streamId, limit }),
            8000
        );
        return asArray<XtreamEpgListing>(
            answer && typeof answer === 'object'
                ? (answer as { epg_listings?: unknown }).epg_listings
                : null
        );
    }

    private mediaUrl(kind: string, id: number, extension: string): string {
        const { server, username, password } = this.credentials;
        const user = encodeURIComponent(username);
        const pass = encodeURIComponent(password);
        return `${server}/${kind}/${user}/${pass}/${id}.${extension}`;
    }

    liveUrl(streamId: number, extension: 'ts' | 'm3u8'): string {
        return this.mediaUrl('live', streamId, extension);
    }

    movieUrl(streamId: number, extension: string): string {
        return this.mediaUrl('movie', streamId, extension || 'mp4');
    }

    episodeUrl(episodeId: number, extension: string): string {
        return this.mediaUrl('series', episodeId, extension || 'mp4');
    }
}

/** An EPG title: the panel sends it base64-encoded UTF-8. */
export function decodeEpgText(value: string | undefined): string {
    if (!value) {
        return '';
    }
    try {
        const binary = window.atob(value);
        let escaped = '';
        for (let i = 0; i < binary.length; i++) {
            const code = binary.charCodeAt(i).toString(16);
            escaped += `%${code.length < 2 ? '0' : ''}${code}`;
        }
        return decodeURIComponent(escaped);
    } catch {
        return value;
    }
}
