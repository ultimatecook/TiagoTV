/**
 * What a title's provider page says about its file's languages. Xtream
 * has no standard field for subtitles; some panels list subtitle files
 * (`info.subtitles`, `movie_data.subtitles`, an episode's `subtitles`) as
 * URLs, objects ({ url | file | src, language | lang, label | name }) or
 * a language → URL map. Only absolute http(s) URLs are kept; they may
 * carry the account's credentials, so they stay in memory, never in
 * storage, logs or Diagnóstico.
 *
 * `info.audio` is the panel's probe of the file's first audio stream
 * (`tags.language`): what plays when the TV lists no audio tracks.
 */
export interface SubtitleSource {
    readonly url: string;
    /** As the provider wrote it ("spa", "es", "Español"), "" if not said. */
    readonly language: string;
    readonly label: string | null;
}

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);

function str(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function first(entry: Raw, keys: readonly string[]): string {
    for (const key of keys) {
        const value = str(entry[key]);
        if (value) {
            return value;
        }
    }
    return '';
}

/**
 * Whether the player can read the file: SRT and VTT (or a URL that does
 * not say). ASS/SSA styling, SAMI and image subtitles (.sub/.idx, .sup)
 * are left out of the list rather than offered and failing.
 */
function readableSubtitle(url: string, declared: string | null): boolean {
    const extension = /\.([a-z0-9]{2,5})$/i.exec(url.split(/[?#]/)[0]);
    const format = `${declared ?? ''} ${extension ? extension[1] : ''}`.toLowerCase();
    return !/\b(ass|ssa|smi|sami|sub|idx|sup|pgs)\b/.test(format);
}

const URL_KEYS = ['url', 'file', 'src', 'link', 'path', 'subtitle_url', 'download'];
const LANGUAGE_KEYS = ['language', 'lang', 'srclang', 'language_code', 'code', 'iso'];
const LABEL_KEYS = ['label', 'name', 'title', 'language_name'];
const FORMAT_KEYS = ['format', 'type', 'ext', 'extension'];

function source(value: unknown, key: string, out: SubtitleSource[]): void {
    const entry: Raw = isObject(value) ? value : { url: value, language: /^\d+$/.test(key) ? '' : key };
    const url = first(entry, URL_KEYS);
    if (!/^https?:\/\/[^\s]+$/i.test(url) || !readableSubtitle(url, first(entry, FORMAT_KEYS) || null)) {
        return;
    }
    if (out.some((known) => known.url === url)) {
        return;
    }
    const tags = isObject(entry['tags']) ? entry['tags'] : {};
    out.push({
        url,
        language: first(entry, LANGUAGE_KEYS) || first(tags, LANGUAGE_KEYS) || (/^\d+$/.test(key) ? '' : key),
        label: first(entry, LABEL_KEYS) || first(tags, ['title']) || null,
    });
}

/** The subtitle files of every field given, without repeats. */
export function subtitleSources(...fields: unknown[]): SubtitleSource[] {
    const out: SubtitleSource[] = [];
    for (const field of fields) {
        if (typeof field === 'string') {
            source(field, '', out);
        } else if (Array.isArray(field)) {
            field.forEach((value) => source(value, '', out));
        } else if (isObject(field)) {
            for (const key of Object.keys(field)) {
                source(field[key], key, out);
            }
        }
    }
    return out.slice(0, 12);
}

/** The subtitle fields of a VOD answer, a series' episode or its info. */
export function subtitleFields(entry: Raw, info: Raw): unknown[] {
    return [entry['subtitles'], entry['subtitle'], info['subtitles'], info['subtitle']];
}

/** The language of the file's first audio stream, if the panel probed it. */
export function audioLanguage(info: Raw): string | null {
    const audio = Array.isArray(info['audio']) ? info['audio'][0] : info['audio'];
    if (!isObject(audio)) {
        return null;
    }
    const tags = isObject(audio['tags']) ? audio['tags'] : {};
    return first(tags, ['language', 'lang']) || first(audio, ['language', 'lang']) || null;
}
