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

/** The provider's code in front of a name: "|ES| ", "|LAT|  ". */
const LEADING_CODE = /^\s*\|[^|]{1,12}\|\s*/;
/** The decoration after it: "✪ ", "★ ". */
const LEADING_MARKS = /^[\s✪★☆•●◆✦]+/;

/**
 * A category's own name, without the provider's code and decoration:
 * "|ES| ✪ DAZN LA LIGA" → "DAZN LA LIGA", "|LAT|  ✪ ARGENTINA" →
 * "ARGENTINA". A name that is nothing else is returned as it came.
 */
export function cleanCategoryName(name: string): string {
    const clean = name
        .replace(LEADING_CODE, '')
        .replace(LEADING_MARKS, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    return clean || name.trim();
}

/**
 * The labels of a category list, in order: each clean name, with the code
 * after it where two categories would otherwise read the same
 * ("|UK| ✪ MUSIC", "|US| ✪ MUSIC" → "MUSIC · UK", "MUSIC · US").
 */
export function categoryDisplayLabels(names: readonly string[]): string[] {
    const labels = names.map(cleanCategoryName);
    const namesByLabel = new Map<string, Set<string>>();
    labels.forEach((label, index) => {
        const key = label.toLowerCase();
        const same = namesByLabel.get(key) ?? new Set<string>();
        same.add(names[index]);
        namesByLabel.set(key, same);
    });
    return labels.map((label, index) => {
        const code = categoryLanguageCode(names[index]);
        const clashes = (namesByLabel.get(label.toLowerCase())?.size ?? 0) > 1;
        return code && clashes ? `${label} · ${code}` : label;
    });
}

/** One category's label among `names`, as {@link categoryDisplayLabels}. */
export function categoryDisplayLabel(
    name: string,
    names: readonly string[]
): string {
    const index = names.indexOf(name);
    return index === -1
        ? cleanCategoryName(name)
        : categoryDisplayLabels(names)[index];
}
