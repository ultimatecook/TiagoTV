/**
 * A track's language for the viewer: files and engines tag tracks with
 * ISO 639-1 ("es"), ISO 639-2 ("spa", "ger"/"deu"), BCP 47 ("es-419",
 * "pt-BR") or only a label ("Español latino", "English SDH"). Everything
 * is normalised to the two-letter code, and named in Spanish.
 */
const NAMES: Readonly<Record<string, string>> = {
    es: 'Español',
    en: 'Inglés',
    pt: 'Portugués',
    fr: 'Francés',
    it: 'Italiano',
    de: 'Alemán',
    ca: 'Catalán',
    eu: 'Euskera',
    gl: 'Gallego',
    nl: 'Neerlandés',
    sv: 'Sueco',
    no: 'Noruego',
    da: 'Danés',
    fi: 'Finés',
    pl: 'Polaco',
    cs: 'Checo',
    hu: 'Húngaro',
    ro: 'Rumano',
    el: 'Griego',
    tr: 'Turco',
    ru: 'Ruso',
    uk: 'Ucraniano',
    ar: 'Árabe',
    he: 'Hebreo',
    hi: 'Hindi',
    ja: 'Japonés',
    ko: 'Coreano',
    zh: 'Chino',
    th: 'Tailandés',
    vi: 'Vietnamita',
    id: 'Indonesio',
};

/** Three-letter codes and names (in English, Spanish and their own). */
const ALIASES: Readonly<Record<string, string>> = {
    spa: 'es', esp: 'es', spanish: 'es', español: 'es', espanol: 'es', castellano: 'es', latino: 'es',
    eng: 'en', english: 'en', inglés: 'en', ingles: 'en',
    por: 'pt', portuguese: 'pt', português: 'pt', portugues: 'pt', portugués: 'pt',
    fre: 'fr', fra: 'fr', french: 'fr', français: 'fr', francés: 'fr', frances: 'fr',
    ita: 'it', italian: 'it', italiano: 'it',
    ger: 'de', deu: 'de', german: 'de', deutsch: 'de', alemán: 'de', aleman: 'de',
    cat: 'ca', català: 'ca', catalán: 'ca', catalan: 'ca',
    baq: 'eu', eus: 'eu', basque: 'eu', euskera: 'eu',
    glg: 'gl', galician: 'gl', gallego: 'gl',
    dut: 'nl', nld: 'nl', dutch: 'nl', nederlands: 'nl',
    swe: 'sv', swedish: 'sv', nor: 'no', nob: 'no', nno: 'no', norwegian: 'no',
    dan: 'da', danish: 'da', fin: 'fi', finnish: 'fi', pol: 'pl', polish: 'pl',
    cze: 'cs', ces: 'cs', czech: 'cs', hun: 'hu', hungarian: 'hu', rum: 'ro', ron: 'ro', romanian: 'ro',
    gre: 'el', ell: 'el', greek: 'el', tur: 'tr', turkish: 'tr', rus: 'ru', russian: 'ru',
    ukr: 'uk', ukrainian: 'uk', ara: 'ar', arabic: 'ar', heb: 'he', hebrew: 'he', hin: 'hi', hindi: 'hi',
    jpn: 'ja', japanese: 'ja', kor: 'ko', korean: 'ko', chi: 'zh', zho: 'zh', chinese: 'zh',
    tha: 'th', thai: 'th', vie: 'vi', vietnamese: 'vi', ind: 'id', indonesian: 'id',
};

const LATIN_AMERICA = /^(419|mx|ar|la|lat|latam|co|cl|pe|ve|us|uy)$/;

/** "spa", "es-ES", "Español" → "es"; "" when unknown ("und"). */
export function languageCode(value: string | null | undefined): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
        return '';
    }
    const base = raw.split(/[-_\s]/)[0];
    if (NAMES[base]) {
        return base;
    }
    return ALIASES[base] ?? ALIASES[raw] ?? '';
}

/** The language a label names ("Spanish (Latin America)", "ENG SDH"). */
function labelLanguage(label: string): string {
    for (const word of label.toLowerCase().split(/[\s()[\],.;:/|_-]+/)) {
        const code = word.length === 2 ? (NAMES[word] ? word : '') : ALIASES[word];
        if (code) {
            return code;
        }
    }
    return '';
}

export interface TrackLanguage {
    /** Two-letter code, "" when unknown. */
    readonly code: string;
    /** "Español latino", "Inglés (para sordos)"; "" when nothing is known. */
    readonly name: string;
    /** Forced subtitles translate only the foreign lines. */
    readonly forced: boolean;
}

/** What a track's `language` and `label` say, in Spanish. */
export function describeTrack(language: string | null | undefined, label: string | null | undefined): TrackLanguage {
    const text = String(label ?? '').trim();
    const lower = `${String(language ?? '').toLowerCase()} ${text.toLowerCase()}`;
    const code = languageCode(language) || labelLanguage(text);
    const forced = /forced|forzad/.test(lower);
    let name = NAMES[code] ?? '';
    if (code === 'es') {
        const region = String(language ?? '').toLowerCase().split(/[-_]/)[1] ?? '';
        if (LATIN_AMERICA.test(region) || /latin|latam/.test(lower)) {
            name = 'Español latino';
        } else if (region === 'es' || /castellano|españa|spain|european/.test(lower)) {
            name = 'Español de España';
        }
    }
    if (!name) {
        return { code, name: text.slice(0, 40), forced };
    }
    const notes: string[] = [];
    if (forced) {
        notes.push('forzados');
    }
    if (/\bsdh\b|\bcc\b|hearing|sordos/.test(lower)) {
        notes.push('para sordos');
    }
    if (/comment|comentar/.test(lower)) {
        notes.push('comentarios');
    }
    if (/descri/.test(lower)) {
        notes.push('audiodescripción');
    }
    return { code, name: notes.length > 0 ? `${name} (${notes.join(', ')})` : name, forced };
}
