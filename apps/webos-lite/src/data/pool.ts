/**
 * Runs `task` over `items` with at most `limit` requests in flight: the
 * provider throttles bursts, and the TV's network stack is slow to open
 * many sockets. A failed item does not stop the others.
 */
export type Settled<R> =
    | { readonly ok: true; readonly value: R }
    | { readonly ok: false; readonly error: unknown };

export function mapSettled<T, R>(
    items: readonly T[],
    limit: number,
    task: (item: T, index: number) => Promise<R>,
    onSettled?: (done: number, total: number) => void
): Promise<Settled<R>[]> {
    const results: Settled<R>[] = new Array(items.length);
    let next = 0;
    let done = 0;
    return new Promise((resolve) => {
        if (items.length === 0) {
            resolve([]);
            return;
        }
        const startNext = (): void => {
            if (next >= items.length) {
                return;
            }
            const index = next++;
            const finish = (result: Settled<R>) => {
                results[index] = result;
                done++;
                onSettled?.(done, items.length);
                if (done === items.length) {
                    resolve(results);
                } else {
                    startNext();
                }
            };
            let promise: Promise<R>;
            try {
                promise = task(items[index], index);
            } catch (error) {
                finish({ ok: false, error });
                return;
            }
            promise.then(
                (value) => finish({ ok: true, value }),
                (error) => finish({ ok: false, error })
            );
        };
        for (let i = 0; i < Math.max(1, limit); i++) {
            startNext();
        }
    });
}
