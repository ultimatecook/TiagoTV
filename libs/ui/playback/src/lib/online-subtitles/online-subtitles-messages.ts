import type { OpenSubtitlesErrorKind } from '@iptvnator/services';

export interface OnlineSubtitlesMessage {
    readonly key: string;
    readonly params?: Record<string, string>;
}

/**
 * The toast for a failed lookup. A search the player started by itself
 * stays quiet when nothing was found or the network failed (the title
 * plays on); one the user asked for always answers.
 */
export function onlineSubtitlesErrorMessage(
    kind: OpenSubtitlesErrorKind,
    options: {
        readonly manual: boolean;
        readonly language: string;
        readonly resetTime: string | null;
    }
): OnlineSubtitlesMessage | null {
    switch (kind) {
        case 'quota':
            return options.resetTime
                ? {
                      key: 'OPEN_SUBTITLES.QUOTA',
                      params: { time: options.resetTime },
                  }
                : { key: 'OPEN_SUBTITLES.QUOTA_NO_TIME' };
        case 'login-failed':
            return { key: 'OPEN_SUBTITLES.LOGIN_FAILED' };
        case 'invalid-key':
            return { key: 'OPEN_SUBTITLES.INVALID_KEY' };
        case 'unavailable':
            return { key: 'OPEN_SUBTITLES.NEEDS_UPDATE' };
        case 'no-key':
            return options.manual ? { key: 'OPEN_SUBTITLES.NO_KEY' } : null;
        case 'rate-limited':
            return options.manual
                ? { key: 'OPEN_SUBTITLES.RATE_LIMITED' }
                : null;
        case 'not-found':
            return options.manual
                ? {
                      key: 'OPEN_SUBTITLES.NOT_FOUND',
                      params: { language: options.language },
                  }
                : null;
        default:
            return options.manual ? { key: 'OPEN_SUBTITLES.NETWORK' } : null;
    }
}

/** "14:05": when the quota comes back, in the user's clock. */
export function formatResetTime(
    resetAt: string | null,
    locale: string | undefined
): string | null {
    const date = resetAt ? new Date(resetAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return null;
    }
    try {
        return new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    } catch {
        return null;
    }
}
