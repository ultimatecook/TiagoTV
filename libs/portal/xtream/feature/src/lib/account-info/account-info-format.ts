import { formatWithIntl } from '@iptvnator/pipes/date-format';

const STATUS_KEY = 'XTREAM.ACCOUNT_INFO.STATUS_VALUE.';

/** The statuses Xtream panels send, in any casing ("Active", "ACTIVE"). */
const KNOWN_STATUSES = new Set([
    'active',
    'expired',
    'banned',
    'disabled',
    'inactive',
    'trial',
]);

/**
 * The translation key of a raw account status, or null for one this app
 * does not know: that one is shown as the panel sent it.
 */
export function accountStatusKey(status?: string | null): string | null {
    const normalized = status?.trim().toLowerCase() ?? '';
    return KNOWN_STATUSES.has(normalized)
        ? `${STATUS_KEY}${normalized.toUpperCase()}`
        : null;
}

/** An account date (Unix seconds) in the app language: "17 mar 2030". */
export function formatAccountDate(
    timestamp: string | undefined,
    locale: string
): string {
    const seconds = Number.parseInt(timestamp ?? '', 10);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return '-';
    }
    return (
        formatWithIntl(seconds * 1000, {
            locale,
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }) || '-'
    );
}

const SERVER_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * The panel's own clock ("2026-10-18 12:00:00", in the panel's time zone)
 * in the app language. It is read as wall-clock time and formatted in UTC,
 * so it is not shifted into this device's zone. Other shapes stay as sent.
 */
export function formatServerTime(
    value: string | undefined,
    locale: string
): string {
    const text = value?.trim() ?? '';
    const match = SERVER_TIME.exec(text);
    if (!match) {
        return text || '-';
    }
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const wallClock = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        Number.isFinite(second) ? second : 0
    );
    return (
        formatWithIntl(wallClock, {
            locale,
            timeZone: 'UTC',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }) || text
    );
}
