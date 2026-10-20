import { GUARD_MS, getJson, type JsonRequest, type RequestMeta } from '../core/http';
import { cleanCategoryName, logRequest } from '../core/request-log';
import { noteServerTime } from '../core/clock';
import { redact } from '../core/redact';
import { PREFETCH, serial, VIEWER, type Priority } from '../core/request-queue';
import { parseAccount, type AccountInfo } from './account';

/**
 * The provider's Xtream API (`player_api.php`), asked one category at a
 * time: a 2019 TV must never parse a whole VOD catalog at once. Catalog
 * requests go through the serial queue (core/request-queue.ts); the
 * account and the programme guide, which the player asks for, do not.
 * Every request lands in the request log (Diagnóstico) by its action and
 * category name, never by its URL.
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

/**
 * How long each kind of request may take. A platform's category list can
 * be several megabytes of series (plots, casts) that a busy panel builds
 * slowly: it gets a minute and a half. Mutable for the smoke run, which
 * shortens them (window.__tiagotv.setTimeouts).
 */
export const TIMEOUTS = {
    list: 90000,
    live: 30000,
    categories: 45000,
    info: 20000,
    account: 12000,
    guide: 8000,
};

/** The queue gives a job up this long after its request's own timeout. */
const WATCHDOG_MARGIN_MS = GUARD_MS + 10000;

const ACTION_LABEL: Readonly<Record<string, string>> = {
    get_live_categories: 'categorías canales',
    get_vod_categories: 'categorías películas',
    get_series_categories: 'categorías series',
    get_live_streams: 'canales',
    get_vod_streams: 'películas',
    get_series: 'series',
    get_vod_info: 'ficha película',
    get_series_info: 'ficha serie',
    get_short_epg: 'guía',
};

function asArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

export class XtreamClient {
    /** Category names by kind and id, for the request log's labels. */
    private readonly names: Record<CatalogKind, Map<string, string>> = {
        live: new Map(),
        vod: new Map(),
        series: new Map(),
    };

    constructor(
        readonly credentials: XtreamCredentials,
        private readonly request: JsonRequest = getJson
    ) {}

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

    /** "series" and "ES NETFLIX SERIES" for a request's log entry. */
    private describe(params: Readonly<Record<string, string | number>>): [string, string] {
        const action = String(params.action ?? '');
        const kind: CatalogKind | null =
            action === 'get_live_streams' ? 'live' : action === 'get_vod_streams' ? 'vod' : action === 'get_series' ? 'series' : null;
        const category = params.category_id !== undefined ? String(params.category_id) : '';
        const name = kind && category ? this.names[kind].get(category) : undefined;
        const id = params.vod_id ?? params.series_id ?? params.stream_id;
        const label = name ? cleanCategoryName(name) : category ? `#${category}` : id !== undefined ? `#${id}` : '';
        return [ACTION_LABEL[action] ?? (action ? 'otra' : 'cuenta'), redact(label, this.secrets)];
    }

    /** A request outside the queue (the account, the guide), logged. */
    private direct(params: Readonly<Record<string, string | number>>, timeoutMs: number): Promise<unknown> {
        const [action, label] = this.describe(params);
        const meta: RequestMeta = { bytes: 0 };
        const started = Date.now();
        return this.request(this.apiUrl(params), timeoutMs, meta).then(
            (value) => {
                logRequest(action, label, started, meta.bytes, null);
                return value;
            },
            (error) => {
                logRequest(action, label, started, meta.bytes, error);
                throw error;
            }
        );
    }

    /** A catalog request, in the queue at `priority`, logged. */
    private queued(params: Readonly<Record<string, string | number>>, timeoutMs: number, priority: Priority): Promise<unknown> {
        const [action, label] = this.describe(params);
        const url = this.apiUrl(params);
        const meta: RequestMeta = { bytes: 0 };
        let started = 0;
        return serial(
            () => {
                started = Date.now();
                return this.request(url, timeoutMs, meta);
            },
            { priority, label: label ? `${action} · ${label}` : action, limitMs: timeoutMs + WATCHDOG_MARGIN_MS }
        ).then(
            (value) => {
                logRequest(action, label, started, meta.bytes, null);
                return value;
            },
            (error) => {
                logRequest(action, label, started, meta.bytes, error);
                throw error;
            }
        );
    }

    async account(): Promise<AccountInfo> {
        const answer = await this.direct({}, TIMEOUTS.account);
        const server = answer && typeof answer === 'object' ? (answer as { server_info?: { timestamp_now?: unknown } }).server_info : null;
        noteServerTime(server ? server.timestamp_now : null);
        return parseAccount(answer);
    }

    async categories(kind: CatalogKind, priority: Priority = VIEWER): Promise<XtreamCategory[]> {
        const list = asArray<XtreamCategory>(
            await this.queued({ action: CATEGORY_ACTION[kind] }, TIMEOUTS.categories, priority)
        ).filter(
            (category) =>
                category &&
                category.category_id !== undefined &&
                typeof category.category_name === 'string'
        );
        this.knowCategories(kind, list);
        return list;
    }

    /** Category names a stored list gives (for the log's labels). */
    knowCategories(kind: CatalogKind, list: readonly XtreamCategory[]): void {
        for (const category of list) {
            this.names[kind].set(String(category.category_id), category.category_name);
        }
    }

    /** A category's entries, at `priority` in the queue (VIEWER first). */
    async streams<T = XtreamLiveStream>(
        kind: CatalogKind,
        categoryId: string | number,
        priority: Priority = VIEWER
    ): Promise<T[]> {
        return asArray<T>(
            await this.queued(
                { action: STREAMS_ACTION[kind], category_id: categoryId },
                kind === 'live' ? TIMEOUTS.live : TIMEOUTS.list,
                priority
            )
        );
    }

    vodInfo(id: number, background = false): Promise<unknown> {
        return this.queued({ action: 'get_vod_info', vod_id: id }, TIMEOUTS.info, background ? PREFETCH : VIEWER);
    }

    seriesInfo(id: number, background = false): Promise<unknown> {
        return this.queued({ action: 'get_series_info', series_id: id }, TIMEOUTS.info, background ? PREFETCH : VIEWER);
    }

    async shortEpg(streamId: number, limit = 2): Promise<XtreamEpgListing[]> {
        const answer = await this.direct({ action: 'get_short_epg', stream_id: streamId, limit }, TIMEOUTS.guide);
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
