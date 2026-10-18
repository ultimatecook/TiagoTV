import {
    MpegTsStreamLoader,
    createMpegTsLoaderConfig,
} from './mpegts-stream-loader';

type ReadResult = { done: boolean; value?: Uint8Array };

/** A response body whose reads the test settles one by one. */
function createBody() {
    const reads: ((result: ReadResult) => void)[] = [];
    const failures: ((error: unknown) => void)[] = [];
    const cancel = jest.fn(() => Promise.resolve());
    const reader = {
        read: jest.fn(
            () =>
                new Promise<ReadResult>((resolve, reject) => {
                    reads.push(resolve);
                    failures.push(reject);
                })
        ),
    };
    return {
        body: { getReader: () => reader, cancel },
        cancel,
        push: (result: ReadResult) => reads.shift()?.(result),
        fail: (error: unknown) => failures.shift()?.(error),
    };
}

function createResponse(
    body: ReturnType<typeof createBody>['body'],
    init: { status?: number; contentLength?: string; url?: string } = {}
) {
    const status = init.status ?? 200;
    return {
        ok: status >= 200 && status <= 299,
        status,
        statusText: status === 403 ? 'Forbidden' : 'OK',
        url: init.url ?? 'https://provider.test/live/u/p/1.ts',
        headers: {
            get: (name: string) =>
                name === 'Content-Length' ? (init.contentLength ?? null) : null,
        },
        body,
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MpegTsStreamLoader', () => {
    const originalFetch = globalThis.fetch;
    const originalHeaders = globalThis.Headers;
    const originalReadableStream = globalThis.ReadableStream;
    let fetchMock: jest.Mock;
    let respond: (response: unknown) => void;
    let rejectFetch: (error: unknown) => void;

    beforeEach(() => {
        fetchMock = jest.fn(
            () =>
                new Promise((resolve, reject) => {
                    respond = resolve;
                    rejectFetch = reject;
                })
        );
        globalThis.fetch = fetchMock as unknown as typeof fetch;
        globalThis.Headers ??= class {
            readonly entries: [string, string][] = [];
            append(key: string, value: string): void {
                this.entries.push([key, value]);
            }
        } as unknown as typeof Headers;
        globalThis.ReadableStream ??= class {} as typeof ReadableStream;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        globalThis.Headers = originalHeaders;
        globalThis.ReadableStream = originalReadableStream;
    });

    function openLoader() {
        const seekHandler = {
            getConfig: jest.fn((url: string) => ({ url, headers: {} })),
            removeURLParameters: (url: string) => url,
        };
        const loader = new MpegTsStreamLoader(seekHandler, {});
        const callbacks = {
            onDataArrival: jest.fn(),
            onError: jest.fn(),
            onComplete: jest.fn(),
            onContentLengthKnown: jest.fn(),
        };
        Object.assign(loader, callbacks);
        loader.open(
            { url: 'https://provider.test/live/u/p/1.ts', duration: 0 },
            { from: 0, to: -1 }
        );
        const signal = (fetchMock.mock.calls[0][1] as RequestInit)
            .signal as AbortSignal;
        return { loader, callbacks, signal };
    }

    it('aborts a streaming live request at once instead of on the next chunk', async () => {
        const { loader, callbacks, signal } = openLoader();
        const body = createBody();
        respond(createResponse(body.body));
        await flush();
        body.push({ done: false, value: new Uint8Array([1, 2, 3]) });
        await flush();
        expect(loader.status).toBe(2); // buffering: the stock loader's skip case
        expect(callbacks.onDataArrival).toHaveBeenCalledWith(
            expect.any(ArrayBuffer),
            0,
            3
        );

        loader.destroy();

        // The connection closes now: a stalled stream never sends the chunk
        // the stock loader waited for before cancelling its reader.
        expect(signal.aborted).toBe(true);
        body.fail(new DOMException('aborted', 'AbortError'));
        await flush();
        expect(callbacks.onError).not.toHaveBeenCalled();
        expect(loader.isWorking()).toBe(false);
    });

    it('aborts a request still waiting for its response headers', async () => {
        const { loader, callbacks, signal } = openLoader();
        expect(loader.isWorking()).toBe(true);

        loader.abort();

        expect(signal.aborted).toBe(true);
        rejectFetch(new DOMException('aborted', 'AbortError'));
        await flush();
        expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('reports a refused stream with its HTTP status and drops the body', async () => {
        const { callbacks } = openLoader();
        const body = createBody();
        respond(createResponse(body.body, { status: 403 }));
        await flush();

        expect(callbacks.onError).toHaveBeenCalledWith(
            'HttpStatusCodeInvalid',
            { code: 403, msg: 'Forbidden' }
        );
        expect(body.cancel).toHaveBeenCalled();
    });

    it('completes a finite source and flags a truncated one as early EOF', async () => {
        const complete = openLoader();
        const body = createBody();
        respond(createResponse(body.body, { contentLength: '4' }));
        await flush();
        body.push({ done: false, value: new Uint8Array([1, 2, 3, 4]) });
        await flush();
        body.push({ done: true });
        await flush();
        expect(complete.callbacks.onContentLengthKnown).toHaveBeenCalledWith(4);
        expect(complete.callbacks.onComplete).toHaveBeenCalledWith(0, 3);

        fetchMock.mockClear();
        const truncated = openLoader();
        const shortBody = createBody();
        respond(createResponse(shortBody.body, { contentLength: '8' }));
        await flush();
        shortBody.push({ done: true });
        await flush();
        expect(truncated.callbacks.onError).toHaveBeenCalledWith('EarlyEof', {
            code: -1,
            msg: 'Fetch stream meet Early-EOF',
        });
    });

    it('routes only http(s) sources through the loader', () => {
        expect(
            createMpegTsLoaderConfig('https://provider.test/live/1.ts')
        ).toEqual({ customLoader: MpegTsStreamLoader });
        expect(createMpegTsLoaderConfig('wss://provider.test/live')).toEqual(
            {}
        );
    });
});
