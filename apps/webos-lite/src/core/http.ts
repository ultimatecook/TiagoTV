/**
 * JSON over XMLHttpRequest: Chrome 53 has fetch but no AbortController,
 * and a provider that hangs must time out. The packaged webOS app reaches
 * the provider directly (cross-origin requests work without CORS there).
 *
 * Errors never carry the URL: Xtream puts the credentials in it.
 */
export type RequestErrorKind = 'http' | 'network' | 'timeout' | 'parse';

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
                    : 'network error'
        );
        this.name = 'RequestError';
    }
}

export type JsonRequest = (url: string, timeoutMs?: number) => Promise<unknown>;

export const DEFAULT_TIMEOUT_MS = 20000;

export const getJson: JsonRequest = (url, timeoutMs = DEFAULT_TIMEOUT_MS) =>
    new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = timeoutMs;
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new RequestError('http', xhr.status));
                return;
            }
            try {
                resolve(JSON.parse(xhr.responseText));
            } catch {
                reject(new RequestError('parse', xhr.status));
            }
        };
        xhr.onerror = () => reject(new RequestError('network'));
        xhr.ontimeout = () => reject(new RequestError('timeout'));
        xhr.send();
    });

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
        case 'http':
            return error.status === 401 || error.status === 403
                ? 'El servidor rechazó la cuenta (usuario o contraseña).'
                : `El servidor respondió con un error (${error.status}).`;
        default:
            return 'No se pudo conectar con el servidor. Revisá la dirección y la red.';
    }
}
