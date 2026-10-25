import type { RowLabel } from '@iptvnator/workspace/dashboard/feature/tv-logic';

/**
 * The Spanish names the desktop app gives "En vivo"'s rows and countries
 * (apps/web/src/assets/i18n/es.json, WORKSPACE.COUNTRIES): the TV shows the
 * same words without loading the app's whole translation file. A test
 * keeps the two in step.
 */
export const ROW_LABELS: Readonly<Record<string, string>> = {
    MAIN: 'Principales',
    SPORTS: 'Deportes',
    EVENTS: 'Eventos en vivo',
    NEWS: 'Noticias',
    MOVIES: 'Cine y series',
    KIDS: 'Infantiles',
    DOCUMENTARY: 'Documentales',
    MUSIC: 'Música',
    MORE: 'Otros canales',
    COPIES: 'Otras versiones',
    IRELAND: 'Irlanda',
    LOCAL: '{{network}} locales',
    LOCAL_OTHER: 'Otras locales',
    TIMESHIFT: 'Diferido (+1)',
};

export const COUNTRY_NAMES: Readonly<Record<string, string>> = {
    AR: 'Argentina',
    ES: 'España',
    GB: 'Reino Unido',
    US: 'Estados Unidos',
};

export const ROW_KEY_PREFIX = 'WORKSPACE.COUNTRIES.ROWS.';

export function rowLabelText(label: RowLabel): string {
    if (!label.key) {
        return label.text;
    }
    const name = label.key.indexOf(ROW_KEY_PREFIX) === 0
        ? label.key.slice(ROW_KEY_PREFIX.length)
        : label.key;
    const template = ROW_LABELS[name] ?? label.text ?? name;
    const params = label.params ?? {};
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
        params[key] !== undefined ? params[key] : ''
    );
}

export function countryName(id: string): string {
    return COUNTRY_NAMES[id.toUpperCase()] ?? id.toUpperCase();
}
