import type {
    OpenSubtitlesBridgeRequest,
    OpenSubtitlesBridgeResponse,
} from '@iptvnator/shared/interfaces';
import type { OpenSubtitlesResult } from './opensubtitles-match';

/** Test double of api.opensubtitles.com behind the main-process bridge. */
export const FAKE_KEY = 'fake-api-key-123';
export const FAKE_USER = 'tiago';
export const FAKE_PASSWORD = 'fake-secret-pass';
export const FAKE_TOKEN = 'fake-jwt-token';

export const FAKE_SRT = [
    '1',
    '00:00:01,000 --> 00:00:03,500',
    '{\\an8}¿Dónde estabas?',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,000',
    'En casa.',
    '',
].join('\r\n');

export function result(
    fileId: number,
    attributes: Partial<NonNullable<OpenSubtitlesResult['attributes']>> = {}
): OpenSubtitlesResult {
    return {
        id: String(fileId),
        attributes: {
            language: 'es',
            download_count: 100,
            release: `Release ${fileId}`,
            files: [{ file_id: fileId, file_name: `file-${fileId}.srt` }],
            ...attributes,
        },
    };
}

export class FakeOpenSubtitlesApi {
    readonly requests: OpenSubtitlesBridgeRequest[] = [];
    /** Search answers by query string ("languages=es&tmdb_id=1"). */
    results = new Map<string, OpenSubtitlesResult[]>();
    remaining = 20;
    /** Download answers 401 this many times first (an expired token). */
    expiredTokens = 0;
    searchStatus = 200;
    files = new Map<string, string>();

    readonly transport = async (
        request: OpenSubtitlesBridgeRequest
    ): Promise<OpenSubtitlesBridgeResponse> => {
        this.requests.push(request);
        if (request.apiKey !== FAKE_KEY) {
            return {
                status: 403,
                data: { message: 'You cannot consume this service' },
            };
        }
        switch (request.operation) {
            case 'login':
                return request.body?.['username'] === FAKE_USER &&
                    request.body?.['password'] === FAKE_PASSWORD
                    ? {
                          status: 200,
                          data: {
                              token: FAKE_TOKEN,
                              base_url: 'api.opensubtitles.com',
                              user: {
                                  allowed_downloads: 20,
                                  remaining_downloads: this.remaining,
                              },
                          },
                      }
                    : {
                          status: 401,
                          data: { message: 'Error, invalid username/password' },
                      };
            case 'search': {
                if (this.searchStatus !== 200) {
                    return { status: this.searchStatus, data: {} };
                }
                const key = new URLSearchParams(
                    request.query as Record<string, string>
                ).toString();
                return {
                    status: 200,
                    data: { data: this.results.get(key) ?? [] },
                };
            }
            case 'download': {
                if (this.expiredTokens > 0 || request.token !== FAKE_TOKEN) {
                    this.expiredTokens = Math.max(0, this.expiredTokens - 1);
                    return { status: 401, data: {} };
                }
                if (this.remaining <= 0) {
                    return {
                        status: 406,
                        data: {
                            remaining: -1,
                            reset_time_utc: '2026-10-25T13:05:00.000Z',
                        },
                    };
                }
                this.remaining -= 1;
                const fileId = Number(request.body?.['file_id']);
                const link = `https://www.opensubtitles.com/download/x/${fileId}.srt`;
                this.files.set(link, FAKE_SRT);
                return {
                    status: 200,
                    data: { link, remaining: this.remaining },
                };
            }
            case 'file':
                return this.files.has(request.url ?? '')
                    ? { status: 200, text: this.files.get(request.url ?? '') }
                    : { status: 404 };
        }
        return { status: 400 };
    };

    operations(): string[] {
        return this.requests.map((request) => request.operation);
    }
}
