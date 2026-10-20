/**
 * JSON over XMLHttpRequest: Chrome 53 has fetch but no AbortController,
 * and a provider that hangs must time out. The packaged webOS app reaches
 * the provider directly (cross-origin requests work without CORS there).
 *
 * A request always settles, once: on its answer, an error, the XHR's own
 * timeout, an abort (webOS cuts requests when the app goes to the
 * background or the network blinks) or, should none of those ever fire,
 * a guard timer a little past the timeout.
 *
 * Errors never carry the URL: Xtream puts the credentials in it.
 */
export type RequestErrorKind = 'http' | 'network' | 'timeout' | 'parse' | 'abort';

export class RequestError extends Error {
    constructor(
        readonly kind: RequestErrorKind,
        readonly status = 0
    ) {
        super(
            kind === 'http'
                ? `HTTP ${status}`
                : kind === 'timeout'
                  ? 'timeout'
                  : kind === 'parse'
                    ? 'invalid JSON'
                    : kind === 'abort'
                      ? 'aborted'
                      : 'network error'
        );
        this.name = 'RequestError';
    }
}

/** What a request reports beside its answer (for Ajustes → Diagnóstico). */
export interface RequestMeta {
    /** Characters of the answer, once it arrived. */
    bytes: number;
}

export type JsonRequest = (url: string, timeoutMs?: number, meta?: RequestMeta) => Promise<unknown>;

export const DEFAULT_TIMEOUT_MS = 20000;
/** How long past its timeout a silent request is given up by the guard. */
export const GUARD_MS = 5000;

export const getJson: JsonRequest = (url, timeoutMs = DEFAULT_TIMEOUT_MS, meta) =>
    new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;
        let guard = 0;
        const finish = (error: RequestError | null, value?: unknown) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(guard);
            xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        };
        xhr.onload = () => {
            const text = xhr.responseText || '';
            if (meta) {
                meta.bytes = text.length;
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                finish(new RequestError('http', xhr.status));
                return;
            }
            let value: unknown;
            try {
                value = JSON.parse(text);
            } catch {
                finish(new RequestError('parse', xhr.status));
                return;
            }
            finish(null, value);
        };
        xhr.onerror = () => finish(new RequestError('network'));
        xhr.ontimeout = () => finish(new RequestError('timeout'));
        xhr.onabort = () => finish(new RequestError('abort'));
        guard = window.setTimeout(() => {
            finish(new RequestError('timeout'));
            try {
                xhr.abort();
            } catch {
                // Already closed.
            }
        }, timeoutMs + GUARD_MS);
        try {
            xhr.open('GET', url, true);
            xhr.timeout = timeoutMs;
            xhr.send();
        } catch {
            finish(new RequestError('network'));
        }
    });

/** The short result Diagnóstico lists: ok, timeout, http 500, red, json… */
export function resultLabel(error: unknown): string {
    if (!error) {
        return 'ok';
    }
    if (!(error instanceof RequestError)) {
        return 'error';
    }
    switch (error.kind) {
        case 'http':
            return `http ${error.status}`;
        case 'network':
            return 'red';
        case 'parse':
            return 'json';
        case 'abort':
            return 'cortada';
        default:
            return 'timeout';
    }
}

/** What a viewer reads when a request fails. */
export function requestErrorText(error: unknown): string {
    if (!(error instanceof RequestError)) {
        return 'Algo salió mal. Probá de nuevo.';
    }
    switch (error.kind) {
        case 'timeout':
            return 'El servidor tardó demasiado en responder.';
        case 'parse':
            return 'El servidor respondió algo que no es una lista Xtream.';
        case 'abort':
            return 'La conexión se cortó antes de terminar.';
        case 'http':
            return error.status === 401 || error.status === 403
                ? 'El servidor rechazó la cuenta (usuario o contraseña).'
                : `El servidor respondió con un error (${error.status}).`;
        default:
            return 'No se pudo conectar con el servidor. Revisá la dirección y la red.';
    }
}
