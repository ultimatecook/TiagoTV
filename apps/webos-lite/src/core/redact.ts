/**
 * Xtream credentials travel in every URL (`?username=…&password=…`,
 * `/live/<user>/<pass>/1.ts`). Anything shown on screen or written to the
 * console goes through `redact` first.
 */
const QUERY_SECRET = /([?&](?:username|password|user|pass)=)[^&#\s]*/gi;
const PATH_SECRET = /(\/(?:live|movie|series|timeshift)\/)[^/\s]+\/[^/\s]+\//gi;

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redact(text: string, secrets: readonly string[] = []): string {
    let out = String(text)
        .replace(QUERY_SECRET, '$1***')
        .replace(PATH_SECRET, '$1***/***/');
    for (const secret of secrets) {
        // One- or two-letter values would blank out ordinary words.
        if (secret && secret.length >= 3) {
            out = out.replace(new RegExp(escapeRegExp(secret), 'g'), '***');
            const encoded = encodeURIComponent(secret);
            if (encoded !== secret) {
                out = out.replace(new RegExp(escapeRegExp(encoded), 'g'), '***');
            }
        }
    }
    return out;
}
