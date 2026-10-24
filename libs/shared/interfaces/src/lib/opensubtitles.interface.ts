/**
 * OpenSubtitles (api.opensubtitles.com, REST v1): subtitles found and
 * downloaded for a movie or episode whose file carries none in the user's
 * language. The account is the user's own: a free opensubtitles.com user
 * plus an API consumer key, typed in Settings → Playback. They are kept in
 * the renderer's settings like the TMDB key, never logged (the key names
 * end in `apiKey`, `username` and `password`, which the shared redaction
 * masks) and never mirrored to the main-process config.
 */
export interface OpenSubtitlesSettings {
    apiKey: string;
    username: string;
    password: string;
    /** The subtitle language searched first (an OpenSubtitles code). */
    language: string;
    /** A second language tried when the first finds nothing; '' for none. */
    secondLanguage: string;
    /** Search by itself when a title starts without such subtitles. */
    autoSearch: boolean;
}

/** The subtitle languages offered, as OpenSubtitles codes them. */
export const OPEN_SUBTITLES_LANGUAGES = [
    'es',
    'sp',
    'ea',
    'en',
    'pt-PT',
    'pt-BR',
    'fr',
    'it',
    'de',
    'ca',
] as const;

export const DEFAULT_OPEN_SUBTITLES_SETTINGS: OpenSubtitlesSettings = {
    apiKey: '',
    username: '',
    password: '',
    language: 'es',
    secondLanguage: '',
    autoSearch: true,
};

function isOfferedLanguage(value: unknown): value is string {
    return (OPEN_SUBTITLES_LANGUAGES as readonly unknown[]).includes(value);
}

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Stored settings, whatever release wrote them: trimmed credentials, a
 * known language (Spanish otherwise), a second language that differs from
 * the first, and the automatic search on unless explicitly switched off.
 * The password keeps its spaces: only a missing value becomes ''.
 */
export function normalizeOpenSubtitlesSettings(
    value: Partial<OpenSubtitlesSettings> | null | undefined
): OpenSubtitlesSettings {
    const stored = value && typeof value === 'object' ? value : {};
    const language = isOfferedLanguage(stored.language)
        ? stored.language
        : DEFAULT_OPEN_SUBTITLES_SETTINGS.language;
    const second = isOfferedLanguage(stored.secondLanguage)
        ? stored.secondLanguage
        : '';
    return {
        apiKey: text(stored.apiKey),
        username: text(stored.username),
        password:
            typeof stored.password === 'string' ? stored.password : '',
        language,
        secondLanguage: second === language ? '' : second,
        autoSearch: stored.autoSearch !== false,
    };
}

/** An API key is enough to search; downloads also count on the account. */
export function hasOpenSubtitlesKey(
    settings: Pick<OpenSubtitlesSettings, 'apiKey'> | null | undefined
): boolean {
    return !!settings?.apiKey?.trim();
}

/** "t•••o": a stored account name as Diagnostics may show it. */
export function maskOpenSubtitlesUser(username: string): string {
    const name = username.trim();
    if (!name) {
        return '';
    }
    return name.length <= 2
        ? '•••'
        : `${name[0]}•••${name[name.length - 1]}`;
}

/**
 * What the renderer may ask the main process to do against OpenSubtitles.
 * Main owns the hosts, paths and the User-Agent header (a browser page can
 * set neither, and the API answers no CORS preflight), so this is no
 * general fetch bridge.
 */
export type OpenSubtitlesBridgeOperation =
    | 'login'
    | 'search'
    | 'download'
    | 'file';

export interface OpenSubtitlesBridgeRequest {
    readonly operation: OpenSubtitlesBridgeOperation;
    readonly apiKey: string;
    /** The login's token: downloads count on the account. */
    readonly token?: string | null;
    /** The login's `base_url` host (api. or vip-api.opensubtitles.com). */
    readonly host?: string | null;
    /** `search`: the query string, already sorted and lowercased. */
    readonly query?: Readonly<Record<string, string>>;
    /** `login` / `download`: the JSON body. */
    readonly body?: Readonly<Record<string, unknown>>;
    /** `file`: the temporary link `download` answered. */
    readonly url?: string;
}

export interface OpenSubtitlesBridgeResponse {
    /** HTTP status; 0 when the request never got an answer. */
    readonly status: number;
    /** The parsed JSON answer (api operations). */
    readonly data?: unknown;
    /** The file's text (`file`). */
    readonly text?: string;
    /** `Retry-After`, in seconds, on a 429. */
    readonly retryAfterSeconds?: number | null;
}
