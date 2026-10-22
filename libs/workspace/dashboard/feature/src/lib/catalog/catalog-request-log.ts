import { inject, Injectable, signal } from '@angular/core';
import {
    categoryLanguageCode,
    cleanCategoryName,
} from '@iptvnator/shared/interfaces';
import { CatalogStreamActivity } from './catalog-stream-activity';

/** How many of the catalog's last provider requests Diagnóstico lists. */
export const CATALOG_REQUEST_LOG_SIZE = 30;

/**
 * How a request ended: `empty` is an answer with nothing in it (a platform
 * category the provider lists always has titles, so it may be a refusal in
 * disguise: a non-list answer reads as an empty one).
 */
export type CatalogRequestResult =
    'ok' | 'empty' | 'timeout' | 'http' | 'cancelled' | 'network' | 'error';

/**
 * One provider request, as Diagnóstico shows it. It never carries the
 * request's address, the provider's host or the account: the action, the
 * category's own name and the outcome only.
 */
export interface CatalogRequestEntry {
    readonly at: number;
    /** The Xtream action: `get_series`, `get_vod_streams`… */
    readonly action: string;
    /** "EN · AMAZON-PRIME", or null for a whole-catalog request. */
    readonly label: string | null;
    readonly ms: number;
    /** Items in the answer, when it is a list. */
    readonly items: number | null;
    readonly result: CatalogRequestResult;
    /** The HTTP status of an `http` failure. */
    readonly status: number | null;
    /** A stream played when it was sent. */
    readonly playing: boolean;
}

/**
 * The catalog's last provider requests (Series, Películas, the platform
 * pages, Buscar and the first-run import), newest first, for Diagnóstico.
 * Kept in memory only.
 */
@Injectable({ providedIn: 'root' })
export class CatalogRequestLog {
    private readonly activity = inject(CatalogStreamActivity);
    private readonly list = signal<readonly CatalogRequestEntry[]>([]);

    readonly entries = this.list.asReadonly();

    /** Runs `task`, one provider request, and records how it went. */
    async track<T>(
        action: string,
        label: string | null,
        task: () => Promise<T>
    ): Promise<T> {
        const at = Date.now();
        const playing = this.activity.playing();
        try {
            const answer = await task();
            const items = Array.isArray(answer) ? answer.length : null;
            this.add({
                at,
                action,
                label,
                ms: Date.now() - at,
                items,
                result: items === 0 ? 'empty' : 'ok',
                status: null,
                playing,
            });
            return answer;
        } catch (error) {
            this.add({
                at,
                action,
                label,
                ms: Date.now() - at,
                items: null,
                ...classifyRequestError(error),
                playing,
            });
            throw error;
        }
    }

    clear(): void {
        this.list.set([]);
    }

    private add(entry: CatalogRequestEntry): void {
        this.list.update((entries) =>
            [entry, ...entries].slice(0, CATALOG_REQUEST_LOG_SIZE)
        );
    }
}

/**
 * A failure's kind, from the error alone. Its message is never kept: a
 * network error names the host it could not reach.
 */
export function classifyRequestError(error: unknown): {
    readonly result: CatalogRequestResult;
    readonly status: number | null;
} {
    const failure = (error ?? {}) as {
        name?: unknown;
        message?: unknown;
        status?: unknown;
        code?: unknown;
    };
    const message = typeof failure.message === 'string' ? failure.message : '';
    const status =
        typeof failure.status === 'number'
            ? failure.status
            : Number(
                  /HTTP Error:?\s*(\d{3})|status code (\d{3})/i
                      .exec(message)
                      ?.slice(1)
                      .find(Boolean) ?? NaN
              );
    if (Number.isInteger(status) && status >= 400) {
        return { result: 'http', status };
    }
    if (failure.name === 'AbortError') {
        return { result: 'cancelled', status: null };
    }
    const text = `${message} ${String(failure.code ?? '')}`;
    if (/time(d)?\s?out|ETIMEDOUT|ECONNABORTED/i.test(text)) {
        return { result: 'timeout', status: null };
    }
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|network/i.test(text)) {
        return { result: 'network', status: null };
    }
    return { result: 'error', status: null };
}

/**
 * A category's name as Diagnóstico shows it: "|EN| ✪ AMAZON-PRIME" →
 * "EN · AMAZON-PRIME", "✪ ORIGINAL AMAZON  MULTI" → "ORIGINAL AMAZON MULTI".
 */
export function categoryLabel(name: string): string {
    const code = categoryLanguageCode(name);
    const clean = cleanCategoryName(name);
    return code ? `${code} · ${clean}` : clean;
}
