import { resultLabel } from './http';

/**
 * The latest provider requests, for Ajustes → Diagnóstico: what was asked
 * ("series", "canales"), of which category (its cleaned name), how long
 * it took, how big the answer was and how it ended. Never a URL, a user
 * name or a password: entries are built from labels, not from requests.
 */
export interface RequestRecord {
    readonly action: string;
    readonly label: string;
    readonly ms: number;
    /** Characters of the answer (0 when none arrived). */
    readonly bytes: number;
    readonly result: string;
    readonly at: number;
}

export const REQUEST_LOG_SIZE = 30;

const records: RequestRecord[] = [];

export function logRequest(action: string, label: string, startedAt: number, bytes: number, error: unknown): void {
    const at = Date.now();
    records.unshift({
        action,
        label,
        ms: startedAt > 0 ? at - startedAt : 0,
        bytes,
        result: resultLabel(error),
        at,
    });
    if (records.length > REQUEST_LOG_SIZE) {
        records.length = REQUEST_LOG_SIZE;
    }
}

/** Newest first. */
export function requestLog(): readonly RequestRecord[] {
    return records.slice();
}

/** "|ES| ✪ ORIGINAL NETFLIX" → "ES ORIGINAL NETFLIX". */
export function cleanCategoryName(name: string): string {
    return name
        .replace(/[|✪★☆•]+/g, ' ')
        .replace(/[ᵁᴴᴰˢ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48);
}
