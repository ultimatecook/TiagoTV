/**
 * TiagoTV shows titles as the film or show is called. Provider catalogs
 * add the year and the audio language around it: "MUERTOS S.L. (2024) ES",
 * "NORSEMEN (2016)_ENG", "EN - TONY - 2026", "|ES| Fauda [2015]".
 *
 * Only marked years go: in brackets or after a dash. A year that is the
 * title, or part of it ("1917", "Blade Runner 2049"), stays.
 */
const TAG =
    '(?:es|en|eng|esp|spa|lat|latino|cast|sub|subs|vose|vos|multi(?:[-_ ]?subs?)?|dual|4k|uhd|fhd|hd)';
/** Country codes lead a title ("US - …") but end real ones ("This Is Us"). */
const LEADING = `(?:${TAG}|uk|us)`;
const LEADING_TAG = new RegExp(
    `^\\s*(?:\\|[^|]{1,10}\\|\\s*|${LEADING}\\s*[-:|]\\s+|${LEADING}\\s*[:|]\\s*)`,
    'i'
);
const TRAILING_TAG = new RegExp(
    `(?:[\\s_-]+${TAG}|\\s*[([]${TAG}[)\\]])\\s*$`,
    'i'
);
const BRACKETED_YEAR = /[\s_-]*[([]\s*(?:19|20)\d{2}\s*[)\]]/g;
const DASHED_YEAR = /\s+[-–]\s+(?:19|20)\d{2}\s*$/;
const STRAY_SEPARATORS = /^[\s\-–_|:·]+|[\s\-–_|:·]+$/g;

export function displayTitle(raw: string): string {
    let title = raw;
    let previous = '';
    while (title !== previous) {
        previous = title;
        title = title
            .replace(LEADING_TAG, '')
            .replace(BRACKETED_YEAR, '')
            .replace(DASHED_YEAR, '')
            .replace(TRAILING_TAG, '')
            .replace(STRAY_SEPARATORS, '');
    }
    return title || raw.trim();
}
