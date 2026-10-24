/**
 * Settings → Playback → "Audio language". `original` (the default, also for
 * settings saved before the choice existed) plays a title in its original
 * language with Spanish subtitles: the catalog opens a show's English
 * version where the provider files one, and inside a file with several
 * audio tracks the players pick the non-Spanish one. `es` keeps the
 * Spanish dub, with subtitles only where they are forced.
 */
export type AudioLanguagePreference = 'original' | 'es';

export const AUDIO_LANGUAGE_VALUES: readonly AudioLanguagePreference[] = [
    'original',
    'es',
];

export const DEFAULT_AUDIO_LANGUAGE: AudioLanguagePreference = 'original';

/** A missing or unknown value is the default, `original`. */
export function normalizeAudioLanguage(
    value: unknown
): AudioLanguagePreference {
    return value === 'es' ? 'es' : DEFAULT_AUDIO_LANGUAGE;
}

const SPANISH_TAG = /^(es|spa|esp)(?:[-_][a-z0-9]+)*$/i;
const SPANISH_NAME =
    /(?:^|[^a-z])(espa[nñ]ol|spanish|castellano|latino|latinoamericano)(?:[^a-z]|$)/i;
const ENGLISH_TAG = /^(en|eng)(?:[-_][a-z0-9]+)*$/i;
const ENGLISH_NAME = /(?:^|[^a-z])(english|ingl[eé]s)(?:[^a-z]|$)/i;

/**
 * Whether a track's language tag ("es", "spa", "es-419") or label
 * ("Español", "Spanish (Latin America)", "Castellano") names Spanish.
 */
export function isSpanishLanguage(value: string | null | undefined): boolean {
    const text = value?.trim() ?? '';
    return !!text && (SPANISH_TAG.test(text) || SPANISH_NAME.test(text));
}

/** Whether a track's language tag or label names English. */
export function isEnglishLanguage(value: string | null | undefined): boolean {
    const text = value?.trim() ?? '';
    return !!text && (ENGLISH_TAG.test(text) || ENGLISH_NAME.test(text));
}

/** mpv's language lists: Spanish in the tags files carry it under. */
const MPV_SPANISH = 'es,spa,es-419,es-ES,es-MX,esp';

/**
 * Original audio: English first, then the languages originals usually come
 * in. mpv selects the first listed language the file carries and falls
 * back to its own default track when none matches, so Spanish (and the
 * Spanish market's Catalan dubs) is never listed.
 */
const MPV_ORIGINAL = [
    'en,eng',
    'ja,jpn',
    'ko,kor',
    'fr,fra,fre',
    'de,deu,ger',
    'it,ita',
    'pt,por',
    'zh,zho,chi',
    'ru,rus',
    'sv,swe',
    'da,dan',
    'no,nor,nb,nob',
    'fi,fin',
    'nl,nld,dut',
    'pl,pol',
    'tr,tur',
    'hi,hin',
    'he,heb',
    'ar,ara',
    'th,tha',
].join(',');

/**
 * What the audio language adds to an embedded MPV session. Original: the
 * non-Spanish audio, Spanish subtitles whenever that audio is not Spanish.
 * Español: the Spanish dub. In both, a subtitle in the audio's own language
 * is selected only when it is forced (mpv 0.38+ `forced`; an older mpv
 * rejects the value and keeps its default).
 */
export function embeddedMpvAudioLanguageOptions(
    preference: AudioLanguagePreference
): readonly string[] {
    return [
        `alang=${preference === 'es' ? MPV_SPANISH : MPV_ORIGINAL}`,
        `slang=${MPV_SPANISH}`,
        'sid=auto',
        'subs-with-matching-audio=forced',
    ];
}
