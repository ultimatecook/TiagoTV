import {
    ESPN_API,
    fetchJsonOrNull,
    SPORTS_DB_API,
    SportsApiClient,
} from './sports-api-client';

describe('SportsApiClient', () => {
    it('asks one request at a time, spaced, under the API', async () => {
        const order: string[] = [];
        const waits: number[] = [];
        let release: () => void = () => undefined;
        const client = new SportsApiClient({
            fetchJson: (url) => {
                order.push(url);
                return url.endsWith('a')
                    ? new Promise((done) => (release = () => done('A')))
                    : Promise.resolve('B');
            },
            wait: async (ms) => void waits.push(ms),
        });

        const a = client.get('lookupteam.php?id=a');
        const b = client.get('lookupteam.php?id=b');
        await Promise.resolve();
        expect(order).toEqual([`${SPORTS_DB_API}lookupteam.php?id=a`]);

        release();
        await expect(a).resolves.toBe('A');
        await expect(b).resolves.toBe('B');
        expect(order).toHaveLength(2);
        // The second waited for the gap after the first.
        expect(waits.length).toBe(1);
        expect(waits[0]).toBeGreaterThan(2500);
    });

    it('tries a refused request again, then gives up', async () => {
        let calls = 0;
        const client = new SportsApiClient({
            fetchJson: async () => {
                calls += 1;
                throw new Error('429');
            },
            wait: async () => undefined,
        });

        await expect(client.get('searchteams.php?t=x')).rejects.toThrow('429');
        expect(calls).toBe(3);
        // The queue goes on after a failure.
        await expect(client.get('searchteams.php?t=y')).rejects.toThrow();
    });

    it('asks another API under its own root and gap', async () => {
        const urls: string[] = [];
        const waits: number[] = [];
        const client = new SportsApiClient(
            {
                fetchJson: async (url) => void urls.push(url),
                wait: async (ms) => void waits.push(ms),
            },
            { base: ESPN_API, gapMs: 1000 }
        );

        await client.get('esp.1/standings');
        await client.get('eng.1/standings');
        expect(urls).toEqual([
            `${ESPN_API}esp.1/standings`,
            `${ESPN_API}eng.1/standings`,
        ]);
        expect(waits[0]).toBeLessThanOrEqual(1000);
    });

    it('reads an empty body as no answer', async () => {
        const original = globalThis.fetch;
        globalThis.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            text: async () => '',
        })) as unknown as typeof fetch;
        try {
            await expect(fetchJsonOrNull('https://x.test')).resolves.toBeNull();
        } finally {
            globalThis.fetch = original;
        }
    });
});
