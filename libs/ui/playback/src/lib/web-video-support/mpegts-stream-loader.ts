import type mpegts from 'mpegts.js';

/** mpegts.js `LoaderStatus` values (its public custom-loader contract). */
const LoaderStatus = {
    Idle: 0,
    Connecting: 1,
    Buffering: 2,
    Error: 3,
    Complete: 4,
} as const;

/** mpegts.js `LoaderErrors` values its IO controller maps to player errors. */
const LoaderError = {
    Exception: 'Exception',
    HttpStatusCodeInvalid: 'HttpStatusCodeInvalid',
    EarlyEof: 'EarlyEof',
} as const;

/** The data source mpegts.js's IO controller hands every loader. */
type LoaderDataSource = mpegts.MediaSegment & {
    readonly cors?: boolean;
    readonly withCredentials?: boolean;
    readonly referrerPolicy?: ReferrerPolicy;
    readonly redirectedURL?: string;
};

type LoaderConfig = mpegts.Config & { readonly reuseRedirectedURL?: boolean };

const noop = (): void => undefined;

/**
 * mpegts.js's fetch stream loader, except that `abort()` always aborts the
 * request. The stock loader skips `AbortController.abort()` on Chromium (and
 * so Electron) once the body is streaming, and only cancels the reader when
 * the next chunk arrives: a destroyed player's live connection closes up to
 * a chunk late — after the next channel's request may already be open — and
 * a stalled stream, which never sends that chunk, stays connected. On a
 * one-connection IPTV account either one refuses or stalls the next stream.
 */
export class MpegTsStreamLoader implements mpegts.BaseLoader {
    _status: number = LoaderStatus.Idle;
    _needStash = true;
    onContentLengthKnown: (contentLength: number) => void = noop;
    onURLRedirect: (redirectedURL: string) => void = noop;
    onDataArrival: (
        chunk: ArrayBuffer,
        byteStart: number,
        receivedLength?: number
    ) => void = noop;
    // The typings declare the error type as the `LoaderErrors` table; the
    // runtime passes one of its string values.
    onError: (
        errorType: unknown,
        errorInfo: mpegts.LoaderErrorMessage
    ) => void = noop;
    onComplete: (rangeFrom: number, rangeTo: number) => void = noop;

    private controller: AbortController | null = null;
    private range: mpegts.Range = { from: 0, to: -1 };
    private contentLength: number | null = null;
    private receivedLength = 0;

    constructor(
        private readonly seekHandler: mpegts.SeekHandler,
        private readonly config: LoaderConfig
    ) {}

    get type(): string {
        return 'fetch-stream-loader';
    }

    get status(): number {
        return this._status;
    }

    get needStashBuffer(): boolean {
        return this._needStash;
    }

    isWorking(): boolean {
        return (
            this._status === LoaderStatus.Connecting ||
            this._status === LoaderStatus.Buffering
        );
    }

    open(source: LoaderDataSource, range: mpegts.Range): void {
        this.range = range;
        this.contentLength = null;
        this.receivedLength = 0;
        const sourceUrl =
            this.config.reuseRedirectedURL && source.redirectedURL
                ? source.redirectedURL
                : source.url;
        const seek = this.seekHandler.getConfig(sourceUrl, range);
        const headers = new Headers();
        appendHeaders(headers, seek.headers);
        appendHeaders(headers, this.config.headers);
        const controller = new AbortController();
        this.controller = controller;
        this._status = LoaderStatus.Connecting;
        fetch(seek.url, {
            method: 'GET',
            headers,
            mode: source.cors === false ? 'same-origin' : 'cors',
            cache: 'default',
            referrerPolicy:
                source.referrerPolicy ?? 'no-referrer-when-downgrade',
            ...(source.withCredentials
                ? { credentials: 'include' as const }
                : {}),
            signal: controller.signal,
        }).then(
            (response) => this.receive(response, seek.url, controller),
            (error: unknown) => this.fail(controller, error)
        );
    }

    abort(): void {
        this.controller?.abort();
    }

    destroy(): void {
        if (this.isWorking()) {
            this.abort();
        }
        this.controller = null;
        this._status = LoaderStatus.Idle;
        this.onContentLengthKnown = noop;
        this.onURLRedirect = noop;
        this.onDataArrival = noop;
        this.onError = noop;
        this.onComplete = noop;
    }

    private receive(
        response: Response,
        url: string,
        controller: AbortController
    ): void {
        if (controller.signal.aborted || !response.body) {
            void response.body?.cancel().catch(noop);
            if (!controller.signal.aborted) {
                this.fail(controller, new Error('Response has no body'));
            }
            return;
        }
        if (!response.ok) {
            void response.body.cancel().catch(noop);
            this._status = LoaderStatus.Error;
            this.onError(LoaderError.HttpStatusCodeInvalid, {
                code: response.status,
                msg: response.statusText,
            });
            return;
        }
        if (response.url && response.url !== url) {
            this.onURLRedirect(
                this.seekHandler.removeURLParameters(response.url)
            );
        }
        const lengthHeader = response.headers.get('Content-Length');
        if (lengthHeader !== null) {
            this.contentLength = parseInt(lengthHeader, 10);
            if (this.contentLength !== 0) {
                this.onContentLengthKnown(this.contentLength);
            }
        }
        this.pump(response.body.getReader(), controller);
    }

    private pump(
        reader: ReadableStreamDefaultReader<Uint8Array>,
        controller: AbortController
    ): void {
        reader.read().then(
            ({ done, value }) => {
                if (controller.signal.aborted) {
                    this._status = LoaderStatus.Complete;
                    return;
                }
                if (done || !value) {
                    this.finish();
                    return;
                }
                this._status = LoaderStatus.Buffering;
                const byteStart = this.range.from + this.receivedLength;
                this.receivedLength += value.byteLength;
                this.onDataArrival(
                    toArrayBuffer(value),
                    byteStart,
                    this.receivedLength
                );
                this.pump(reader, controller);
            },
            (error: unknown) => this.fail(controller, error)
        );
    }

    private finish(): void {
        if (
            this.contentLength !== null &&
            this.receivedLength < this.contentLength
        ) {
            this._status = LoaderStatus.Error;
            this.onError(LoaderError.EarlyEof, {
                code: -1,
                msg: 'Fetch stream meet Early-EOF',
            });
            return;
        }
        this._status = LoaderStatus.Complete;
        this.onComplete(
            this.range.from,
            this.range.from + this.receivedLength - 1
        );
    }

    private fail(controller: AbortController, error: unknown): void {
        if (controller.signal.aborted) {
            this._status = LoaderStatus.Complete;
            return;
        }
        this._status = LoaderStatus.Error;
        const { code, message } = (error ?? {}) as {
            code?: number;
            message?: string;
        };
        const earlyEof =
            (code === 19 || message === 'network error') &&
            (this.contentLength === null ||
                this.receivedLength < this.contentLength);
        this.onError(earlyEof ? LoaderError.EarlyEof : LoaderError.Exception, {
            code: code ?? -1,
            msg: earlyEof ? 'Fetch stream meet Early-EOF' : (message ?? ''),
        });
    }
}

/**
 * Player config routing an http(s) MPEG-TS source through
 * {@link MpegTsStreamLoader}. Other URLs (WebSocket) and runtimes without
 * streaming fetch keep mpegts.js's own loader selection.
 */
export function createMpegTsLoaderConfig(url: string): mpegts.Config {
    return /^https?:/i.test(url) &&
        typeof fetch === 'function' &&
        typeof AbortController === 'function' &&
        typeof Headers === 'function' &&
        typeof ReadableStream === 'function'
        ? { customLoader: MpegTsStreamLoader }
        : {};
}

function appendHeaders(headers: Headers, source: unknown): void {
    if (!source || typeof source !== 'object' || source instanceof Headers) {
        return;
    }
    for (const key of Object.keys(source)) {
        headers.append(key, String((source as Record<string, unknown>)[key]));
    }
}

function toArrayBuffer(chunk: Uint8Array): ArrayBuffer {
    return chunk.byteOffset === 0 &&
        chunk.byteLength === chunk.buffer.byteLength &&
        chunk.buffer instanceof ArrayBuffer
        ? chunk.buffer
        : chunk.slice().buffer;
}
