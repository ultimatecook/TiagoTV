/**
 * Why a subtitle could not be had, as the player's message says it:
 * - `unavailable`: this app has no OpenSubtitles bridge (the browser build,
 *   or a desktop installer from before it);
 * - `no-key`: no API key typed in Settings;
 * - `invalid-key`: OpenSubtitles refused the API key;
 * - `login-failed`: wrong username or password;
 * - `quota`: the account's downloads for the day are used up (`resetAt`);
 * - `rate-limited`: too many requests just now;
 * - `not-found`: no subtitle in the languages asked for;
 * - `network`: no answer, or one the app cannot read.
 */
export type OpenSubtitlesErrorKind =
    | 'unavailable'
    | 'no-key'
    | 'invalid-key'
    | 'login-failed'
    | 'quota'
    | 'rate-limited'
    | 'not-found'
    | 'network';

export class OpenSubtitlesError extends Error {
    constructor(
        readonly kind: OpenSubtitlesErrorKind,
        /** `quota`: when the downloads come back, as OpenSubtitles says. */
        readonly resetAt: string | null = null
    ) {
        // The kind only: an answer's text can echo what was sent.
        super(`OpenSubtitles: ${kind}`);
        this.name = 'OpenSubtitlesError';
    }
}

export function isOpenSubtitlesError(
    error: unknown
): error is OpenSubtitlesError {
    return error instanceof OpenSubtitlesError;
}
