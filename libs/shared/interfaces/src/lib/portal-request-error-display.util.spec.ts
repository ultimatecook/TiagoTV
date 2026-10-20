import { buildHostConnectivityFastFailMessage } from './host-connectivity.util';
import { createPortalRequestError } from './portal-request-failure.util';
import {
    describePortalRequestError,
    PORTAL_REQUEST_ERROR_KEYS,
    readPortalRequestErrorStatus,
    toSafePortalRequestErrorMessage,
} from './portal-request-error-display.util';
import { sourceHealthError } from './source-health';

// Obviously fake credentials: what an Angular HttpErrorResponse carries when
// the PWA's backend proxy answers 500 for an Xtream call.
const PROXY_URL =
    'http://localhost:3000/xtream?targetId=t1&action=get_vod_info&username=fake-user&password=fake-pass';
const httpFailure = (status: number) => ({
    name: 'HttpErrorResponse',
    status,
    statusText: 'Internal Server Error',
    url: PROXY_URL,
    message: `Http failure response for ${PROXY_URL}: ${status} Internal Server Error`,
    error: `proxy error for ${PROXY_URL}`,
});

const FALLBACK = 'Could not connect to the server';

describe('portal request error display', () => {
    it('never repeats the URL or credentials of an HTTP failure', () => {
        const error = httpFailure(500);

        const shown = describePortalRequestError(error);
        const handedBack = toSafePortalRequestErrorMessage(error, FALLBACK);

        expect(shown).toEqual({
            key: PORTAL_REQUEST_ERROR_KEYS.status,
            params: { status: 500 },
        });
        expect(handedBack).toBe('HTTP Error 500');
        for (const text of [JSON.stringify(shown), handedBack]) {
            expect(text).not.toContain('fake-user');
            expect(text).not.toContain('fake-pass');
            expect(text).not.toContain('localhost:3000');
        }
    });

    it('reports a request that never got an answer as unreachable', () => {
        const error = httpFailure(0);

        expect(describePortalRequestError(error)).toEqual({
            key: PORTAL_REQUEST_ERROR_KEYS.unreachable,
        });
        expect(toSafePortalRequestErrorMessage(error, FALLBACK)).toBe(
            FALLBACK
        );
    });

    it('drops raw transport text that names no status', () => {
        const error = new Error(
            "Error invoking remote method 'XTREAM_REQUEST': Error: connect ECONNREFUSED http://fake-user:fake-pass@portal.example"
        );

        expect(toSafePortalRequestErrorMessage(error, FALLBACK)).toBe(
            FALLBACK
        );
        expect(describePortalRequestError(error).key).toBe(
            PORTAL_REQUEST_ERROR_KEYS.unreachable
        );
    });

    it.each([
        ['HTTP Error 404: Not Found', 404],
        ["Error invoking remote method 'STALKER_REQUEST': HTTP Error 403", 403],
        ['HTTP Error: 502', 502],
        ['Error: Internal Server Error (Status: 500)', 500],
    ])('reads the status out of %s', (message, status) => {
        expect(readPortalRequestErrorStatus(new Error(message))).toBe(status);
    });

    it('keeps the classifications callers read from the message', () => {
        const refused = createPortalRequestError(
            { kind: 'http', status: 401, statusText: 'Unauthorized' },
            'xtream'
        );
        const cancelled = createPortalRequestError(
            { kind: 'cancelled' },
            'xtream'
        );
        const fastFail = new Error(
            buildHostConnectivityFastFailMessage('http://portal.example:8080')
        );

        expect(
            sourceHealthError(
                new Error(toSafePortalRequestErrorMessage(refused, FALLBACK))
            ).reason
        ).toBe('auth');
        expect(toSafePortalRequestErrorMessage(cancelled, FALLBACK)).toBe(
            'Xtream request cancelled'
        );
        expect(toSafePortalRequestErrorMessage(fastFail, FALLBACK)).toBe(
            fastFail.message
        );
        expect(describePortalRequestError(fastFail)).toEqual({
            key: PORTAL_REQUEST_ERROR_KEYS.paused,
        });
    });
});
