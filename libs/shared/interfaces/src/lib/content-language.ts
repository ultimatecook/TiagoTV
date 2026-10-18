/**
 * TiagoTV keeps Spanish and English content only. Providers tag each
 * category with a country or language code: "|ES| ✪ DAZN LA LIGA",
 * "|LAT|  ✪ ARGENTINA", "|EN| ✪ ACTION". The codes that read as Spanish
 * or English are kept; inside them, the Portuguese (Brazil) and French
 * (Quebec) groups are not.
 *
 * Careful: on these panels |AR| is Arabic, not Argentina (which sits in
 * |LAT|).
 */
export type ContentKind = 'live' | 'vod' | 'series';

const KEPT_CODES: Record<ContentKind, ReadonlySet<string>> = {
    live: new Set(['ES', 'LAT', 'UK', 'US', 'CA', 'EN']),
    vod: new Set(['ES', 'EN', 'LAT', 'CA']),
    series: new Set(['ES', 'EN', 'LAT', 'MULTI']),
};

/**
 * Groups in another language inside otherwise kept codes: Portuguese
 * (Brazil), French (Quebec), and the Arabic and Asian packs some panels
 * file under |UK|.
 */
const OTHER_LANGUAGE =
    /\b(brazil|brasil|quebec\w*|portug\w*|arabic|asia)\b|\bbr\s/i;
/** Inside MULTI, only the English groups. */
const ENGLISH = /\benglish\b/i;

/** The leading "|XX|" code of a category name, upper-cased. */
export function categoryLanguageCode(name: string): string | null {
    const match = /^\s*\|\s*([A-Za-z]{2,5})\s*\|/.exec(name);
    return match ? match[1].toUpperCase() : null;
}

export function isSpanishOrEnglishCategory(
    name: string,
    kind: ContentKind
): boolean {
    const code = categoryLanguageCode(name);
    if (!code || !KEPT_CODES[kind].has(code)) {
        return false;
    }
    if (OTHER_LANGUAGE.test(name)) {
        return false;
    }
    return code !== 'MULTI' || ENGLISH.test(name);
}
