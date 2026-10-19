/**
 * The free sports APIs the sports views read (no key of ours, CORS-enabled):
 * TheSportsDB for the team crests and the fallback tables, ESPN's public
 * site API for the league tables. Each API has one client for the whole
 * app: one request at a time, a gap apart, a refused one tried again after
 * a pause.
 */
export const SPORTS_DB_API = 'https://www.thesportsdb.com/api/v1/json/123/';
export const ESPN_API = 'https://site.api.espn.com/apis/v2/sports/soccer/';
/** TheSportsDB refuses bursts: one request every 3s stays under it. */
const DEFAULT_GAP_MS = 3000;
/** A refused request is tried twice more, after this pause each time. */
const DEFAULT_RETRY_MS = 25_000;
const RETRIES = 2;

export interface SportsApiClientDeps {
    /**
     * The body of `url` (null for an empty one); rejects when the API
     * refuses or fails, which is not an empty answer.
     */
    readonly fetchJson: (url: string) => Promise<unknown>;
    readonly wait?: (ms: number) => Promise<void>;
}

export interface SportsApiOptions {
    /** The API's root, which every path is under. */
    readonly base: string;
    readonly gapMs: number;
    readonly retryMs: number;
}

export class SportsApiClient {
    private queue: Promise<unknown> = Promise.resolve();
    private lastRequestAt = 0;
    private readonly options: SportsApiOptions;

    constructor(
        private readonly deps: SportsApiClientDeps,
        options: Partial<SportsApiOptions> = {}
    ) {
        this.options = {
            base: options.base ?? SPORTS_DB_API,
            gapMs: options.gapMs ?? DEFAULT_GAP_MS,
            retryMs: options.retryMs ?? DEFAULT_RETRY_MS,
        };
    }

    /** `path` under the API ("lookupteam.php?id=133720"), in turn. */
    get(path: string): Promise<unknown> {
        const request = this.queue.then(() =>
            this.request(this.options.base + path)
        );
        this.queue = request.catch(() => null);
        return request;
    }

    private async request(url: string): Promise<unknown> {
        const wait =
            this.deps.wait ??
            ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
        const gap = this.lastRequestAt + this.options.gapMs - Date.now();
        if (gap > 0) {
            await wait(gap);
        }
        for (let attempt = 0; ; attempt++) {
            this.lastRequestAt = Date.now();
            try {
                return await this.deps.fetchJson(url);
            } catch (error) {
                if (attempt >= RETRIES) {
                    throw error;
                }
                await wait(this.options.retryMs);
            }
        }
    }
}

/** The browser's fetch, an empty body read as null. */
export async function fetchJsonOrNull(url: string): Promise<unknown> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`The sports API answered ${response.status}`);
    }
    const text = await response.text();
    return text.trim() ? JSON.parse(text) : null;
}
