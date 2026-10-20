import { isHostConnectivityFastFailMessage } from './host-connectivity.util';
import {
    formatPortalHttpErrorMessage,
    isPortalRequestCancelledError,
} from './portal-request-failure.util';

/**
 * What a failed portal request may show and hand back, without its own text.
 *
 * The raw error is never shown. An Angular `HttpErrorResponse` reads
 * `Http failure response for <url>: 500 …`, and on the PWA that URL is the
 * backend's `/xtream` proxy with the Xtream `username` and `password` in its
 * query; an Electron rejection carries Electron's wrapper and raw transport
 * text. Only the HTTP status is worth repeating to the person.
 */
export const PORTAL_REQUEST_ERROR_KEYS = {
    /** Takes `{{status}}`. */
    status: 'PORTALS.REQUEST_ERRORS.SERVER_STATUS',
    unreachable: 'PORTALS.REQUEST_ERRORS.SERVER_UNREACHABLE',
    /** The connectivity guard skipped the request. */
    paused: 'PORTALS.REQUEST_ERRORS.SERVER_PAUSED',
} as const;

export interface PortalRequestErrorText {
    readonly key: string;
    readonly params?: { readonly status: number };
}

/** `HTTP Error 404`, `HTTP Error: 404`, `… (Status: 500)`. */
const STATUS_IN_MESSAGE = /\bHTTP Error:? (\d{3})\b|\(Status: (\d{3})\)/i;

function readMessage(error: unknown): string {
    if (typeof error === 'string') {
        return error;
    }
    const message = (error as { message?: unknown } | null)?.message;
    return typeof message === 'string' ? message : '';
}

function isHttpStatus(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 100 &&
        value <= 599
    );
}

/**
 * The HTTP status of a failed portal request: its numeric `status`, else
 * the one its message names in the shapes the data services produce. Null
 * for a request that never got an answer (status 0, a network failure).
 */
export function readPortalRequestErrorStatus(error: unknown): number | null {
    const status = (error as { status?: unknown } | null)?.status;
    if (isHttpStatus(status)) {
        return status;
    }
    const match = STATUS_IN_MESSAGE.exec(readMessage(error));
    const parsed = Number(match?.[1] ?? match?.[2]);
    return isHttpStatus(parsed) ? parsed : null;
}

/** The translation key (and params) a person sees for a failed request. */
export function describePortalRequestError(
    error: unknown
): PortalRequestErrorText {
    if (isHostConnectivityFastFailMessage(readMessage(error))) {
        return { key: PORTAL_REQUEST_ERROR_KEYS.paused };
    }
    const status = readPortalRequestErrorStatus(error);
    return status === null
        ? { key: PORTAL_REQUEST_ERROR_KEYS.unreachable }
        : { key: PORTAL_REQUEST_ERROR_KEYS.status, params: { status } };
}

/**
 * The message a failed request hands back to its caller, which may show it
 * (a detail page's error) and classifies it (`sourceHealthError`, the
 * account dialog's paused state). It keeps the shapes those read — the
 * guard's fast-fail sentence (an origin, never credentials), a cancellation,
 * `HTTP Error <status>` — and is `fallback` otherwise.
 */
export function toSafePortalRequestErrorMessage(
    error: unknown,
    fallback: string
): string {
    const message = readMessage(error);
    if (isHostConnectivityFastFailMessage(message)) {
        return message;
    }
    if (isPortalRequestCancelledError(error)) {
        return message || fallback;
    }
    const status = readPortalRequestErrorStatus(error);
    return status === null ? fallback : formatPortalHttpErrorMessage(status);
}
