import { normalizeDateLocale } from './date-format.util';

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * The app language for a number formatted outside a component: `<html
 * lang>`, which the app keeps in step with the translation language.
 */
export function documentLocale(): string {
    return (
        (typeof document !== 'undefined' && document.documentElement?.lang) ||
        'en'
    );
}

function ratingFormatter(locale: string): Intl.NumberFormat {
    const resolved = normalizeDateLocale(locale);
    let formatter = formatters.get(resolved);
    if (!formatter) {
        const options = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
        try {
            formatter = new Intl.NumberFormat(resolved, options);
        } catch {
            formatter = new Intl.NumberFormat('en', options);
        }
        formatters.set(resolved, formatter);
    }
    return formatter;
}

/**
 * A rating with one decimal and the language's separator: 7.2 reads
 * "7,2" in Spanish. A numeric string ("7.2", "7,2") is read as its number;
 * other text ("PG-13") is kept as sent, and an empty value is empty.
 */
export function formatRating(
    value: number | string | null | undefined,
    locale: string = documentLocale()
): string {
    if (value === null || value === undefined) {
        return '';
    }
    const text = String(value).trim();
    const numeric =
        typeof value === 'number' ? value : Number(text.replace(',', '.'));
    if (!text || !Number.isFinite(numeric)) {
        return text;
    }
    return ratingFormatter(locale).format(numeric);
}
