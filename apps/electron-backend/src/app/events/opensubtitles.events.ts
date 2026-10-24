import { app, ipcMain, net } from 'electron';
import {
    OPENSUBTITLES_REQUEST,
    type OpenSubtitlesBridgeRequest,
    type OpenSubtitlesBridgeResponse,
} from '@iptvnator/shared/interfaces';

/**
 * OpenSubtitles REST v1 for the renderer. The API answers no CORS
 * preflight (a page sending its `Api-Key` header is refused) and wants a
 * User-Agent naming the app, which a page cannot set, so main makes the
 * calls. It is not a general fetch bridge: the hosts and paths are fixed
 * here, a file is fetched only from OpenSubtitles' own hosts, and nothing
 * of a request (key, token, account, query) is ever logged.
 */
const API_HOSTS = new Set([
    'api.opensubtitles.com',
    'vip-api.opensubtitles.com',
]);
const DEFAULT_HOST = 'api.opensubtitles.com';
const FILE_HOST = /(^|\.)opensubtitles\.(com|org)$/i;
const TIMEOUT_MS = 20_000;
/** A subtitle file is tens of kilobytes; anything far bigger is not one. */
export const MAX_SUBTITLE_BYTES = 4 * 1024 * 1024;

const ROUTES = {
    login: { method: 'POST', path: '/api/v1/login' },
    search: { method: 'GET', path: '/api/v1/subtitles' },
    download: { method: 'POST', path: '/api/v1/download' },
} as const;

export interface OpenSubtitlesHttpRequest {
    readonly url: string;
    readonly method: 'GET' | 'POST';
    readonly headers: Record<string, string>;
    readonly body?: string;
}

/** The HTTP request a bridge request stands for; null when not allowed. */
export function toOpenSubtitlesHttpRequest(
    request: OpenSubtitlesBridgeRequest,
    appVersion: string
): OpenSubtitlesHttpRequest | null {
    const apiKey =
        typeof request?.apiKey === 'string' ? request.apiKey.trim() : '';
    if (!apiKey || /[\r\n]/.test(apiKey)) {
        return null;
    }
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Api-Key': apiKey,
        'User-Agent': `TiagoTV v${appVersion}`,
    };
    if (request.operation === 'file') {
        const url = safeUrl(request.url);
        return url && url.protocol === 'https:' && FILE_HOST.test(url.hostname)
            ? {
                  url: url.toString(),
                  method: 'GET',
                  headers: { 'User-Agent': headers['User-Agent'] },
              }
            : null;
    }
    const route = ROUTES[request.operation as keyof typeof ROUTES];
    if (!route) {
        return null;
    }
    const host =
        request.host && API_HOSTS.has(request.host)
            ? request.host
            : DEFAULT_HOST;
    const url = new URL(`https://${host}${route.path}`);
    if (route.method === 'GET') {
        for (const [key, value] of Object.entries(request.query ?? {})) {
            if (typeof value === 'string') {
                url.searchParams.append(key, value);
            }
        }
    }
    const token = typeof request.token === 'string' ? request.token.trim() : '';
    if (token && !/[\r\n]/.test(token)) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (route.method === 'POST') {
        headers['Content-Type'] = 'application/json';
    }
    return {
        url: url.toString(),
        method: route.method,
        headers,
        ...(route.method === 'POST'
            ? { body: JSON.stringify(request.body ?? {}) }
            : {}),
    };
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Runs one bridge request; never throws, never logs what it sent. */
export async function runOpenSubtitlesRequest(
    request: OpenSubtitlesBridgeRequest,
    appVersion: string,
    fetchImpl: Fetch
): Promise<OpenSubtitlesBridgeResponse> {
    const http = toOpenSubtitlesHttpRequest(request, appVersion);
    if (!http) {
        return { status: 400 };
    }
    try {
        const response = await fetchImpl(http.url, {
            method: http.method,
            headers: http.headers,
            body: http.body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await response.text();
        if (text.length > MAX_SUBTITLE_BYTES) {
            return { status: 0 };
        }
        const retryAfter = Number(response.headers.get('retry-after'));
        const base = {
            status: response.status,
            retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
        };
        if (request.operation === 'file') {
            return { ...base, text };
        }
        return { ...base, data: parseJson(text) };
    } catch {
        // Offline, timed out or refused: the kind is all the renderer needs.
        return { status: 0 };
    }
}

export function registerOpenSubtitlesHandlers(): void {
    ipcMain.handle(
        OPENSUBTITLES_REQUEST,
        (_event, request: OpenSubtitlesBridgeRequest) =>
            runOpenSubtitlesRequest(request, app.getVersion(), (url, init) =>
                net.fetch(url, init)
            )
    );
}

function safeUrl(value: unknown): URL | null {
    try {
        return typeof value === 'string' ? new URL(value) : null;
    } catch {
        return null;
    }
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
