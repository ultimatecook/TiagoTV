import { inject, Injectable, InjectionToken } from '@angular/core';
import type {
    OpenSubtitlesBridgeRequest,
    OpenSubtitlesBridgeResponse,
    OpenSubtitlesSettings,
} from '@iptvnator/shared/interfaces';
import { OpenSubtitlesError } from './opensubtitles-error';
import type { OpenSubtitlesResult } from './opensubtitles-match';

/** Sends one request to OpenSubtitles; the desktop app's main process does. */
export type OpenSubtitlesTransport = (
    request: OpenSubtitlesBridgeRequest
) => Promise<OpenSubtitlesBridgeResponse>;

/**
 * The preload bridge, or null where there is none: the browser build (the
 * API answers no CORS preflight, so a page cannot call it) and desktop
 * installers from before the bridge. Tests provide a fake API here.
 */
export const OPEN_SUBTITLES_TRANSPORT =
    new InjectionToken<OpenSubtitlesTransport | null>(
        'OPEN_SUBTITLES_TRANSPORT',
        {
            providedIn: 'root',
            factory: () => {
                const bridge =
                    typeof window === 'undefined'
                        ? undefined
                        : window.electron?.openSubtitlesRequest;
                return typeof bridge === 'function'
                    ? (request) => bridge(request)
                    : null;
            },
        }
    );

export interface OpenSubtitlesQuota {
    /** Downloads left today; null when OpenSubtitles did not say. */
    readonly remaining: number | null;
    readonly allowed: number | null;
}

interface Session {
    readonly account: string;
    readonly token: string;
    readonly host: string | null;
}

interface LoginAnswer {
    readonly token?: string;
    readonly base_url?: string;
    readonly user?: {
        readonly allowed_downloads?: number;
        readonly remaining_downloads?: number;
    };
}

interface DownloadAnswer {
    readonly link?: string;
    readonly file_name?: string;
    readonly remaining?: number;
    readonly reset_time_utc?: string;
}

/**
 * OpenSubtitles REST v1 through the main process: login (its token is kept
 * in memory for the run, never stored or logged), search and download.
 * Every failure is an `OpenSubtitlesError` naming its kind only.
 */
@Injectable({ providedIn: 'root' })
export class OpenSubtitlesApi {
    private readonly transport = inject(OPEN_SUBTITLES_TRANSPORT);
    private session: Session | null = null;
    private loggingIn: Promise<Session | null> | null = null;

    get available(): boolean {
        return this.transport !== null;
    }

    /** Signs in (again with `force`); null for an account without login. */
    async login(
        account: OpenSubtitlesSettings,
        force = false
    ): Promise<{ session: Session | null; quota: OpenSubtitlesQuota }> {
        const id = accountId(account);
        if (!account.username || !account.password) {
            return { session: null, quota: { remaining: null, allowed: null } };
        }
        if (!force && this.session?.account === id) {
            return {
                session: this.session,
                quota: { remaining: null, allowed: null },
            };
        }
        const answer = await this.send({
            operation: 'login',
            apiKey: account.apiKey,
            body: { password: account.password, username: account.username },
        });
        if (answer.status !== 200) {
            throw new OpenSubtitlesError(
                answer.status === 401 ? 'login-failed' : failureKind(answer)
            );
        }
        const data = (answer.data ?? {}) as LoginAnswer;
        if (!data.token) {
            throw new OpenSubtitlesError('network');
        }
        this.session = {
            account: id,
            token: data.token,
            host: data.base_url ?? null,
        };
        return {
            session: this.session,
            quota: {
                remaining: numberOrNull(data.user?.remaining_downloads),
                allowed: numberOrNull(data.user?.allowed_downloads),
            },
        };
    }

    async search(
        account: OpenSubtitlesSettings,
        query: Readonly<Record<string, string>>
    ): Promise<OpenSubtitlesResult[]> {
        const answer = await this.send({
            operation: 'search',
            apiKey: account.apiKey,
            host:
                this.session?.account === accountId(account)
                    ? this.session.host
                    : null,
            query,
        });
        if (answer.status !== 200) {
            throw new OpenSubtitlesError(failureKind(answer));
        }
        const data = (answer.data as { data?: unknown } | undefined)?.data;
        return Array.isArray(data) ? (data as OpenSubtitlesResult[]) : [];
    }

    /** The file's text and the downloads left today. */
    async download(
        account: OpenSubtitlesSettings,
        fileId: number
    ): Promise<{ text: string; remaining: number | null }> {
        let { session } = await this.login(account);
        let answer = await this.requestLink(account, session, fileId);
        if (answer.status === 401 && session) {
            // The token expired: sign in once more, then give up.
            ({ session } = await this.login(account, true));
            answer = await this.requestLink(account, session, fileId);
        }
        const data = (answer.data ?? {}) as DownloadAnswer;
        if (answer.status === 406) {
            throw new OpenSubtitlesError('quota', data.reset_time_utc ?? null);
        }
        if (answer.status !== 200 || !data.link) {
            throw new OpenSubtitlesError(failureKind(answer));
        }
        const file = await this.send({
            operation: 'file',
            apiKey: account.apiKey,
            url: data.link,
        });
        if (file.status !== 200 || typeof file.text !== 'string') {
            throw new OpenSubtitlesError('network');
        }
        return { text: file.text, remaining: numberOrNull(data.remaining) };
    }

    /** Forgets the token, e.g. after the account changed in Settings. */
    signOut(): void {
        this.session = null;
    }

    private requestLink(
        account: OpenSubtitlesSettings,
        session: Session | null,
        fileId: number
    ): Promise<OpenSubtitlesBridgeResponse> {
        return this.send({
            operation: 'download',
            apiKey: account.apiKey,
            token: session?.token ?? null,
            host: session?.host ?? null,
            body: { file_id: fileId },
        });
    }

    private async send(
        request: OpenSubtitlesBridgeRequest
    ): Promise<OpenSubtitlesBridgeResponse> {
        if (!this.transport) {
            throw new OpenSubtitlesError('unavailable');
        }
        if (!request.apiKey.trim()) {
            throw new OpenSubtitlesError('no-key');
        }
        try {
            return await this.transport(request);
        } catch {
            throw new OpenSubtitlesError('network');
        }
    }
}

/** Which account a token belongs to; compared in memory only. */
function accountId(account: OpenSubtitlesSettings): string {
    return `${account.apiKey}\u0000${account.username}\u0000${account.password}`;
}

function failureKind(answer: OpenSubtitlesBridgeResponse) {
    switch (answer.status) {
        case 401:
        case 403:
            return 'invalid-key' as const;
        case 406:
            return 'quota' as const;
        case 429:
            return 'rate-limited' as const;
        default:
            return 'network' as const;
    }
}

function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
