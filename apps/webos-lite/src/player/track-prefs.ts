import type { StorageLike } from '../core/storage';
import { languageCode } from './languages';

/**
 * The viewer's subtitle and audio languages, as plain strings in
 * localStorage (like Fluidez):
 *
 *   tiagotv.lite.subtitles  a two-letter language ("es") or "off";
 *                           missing means "es" (Spanish subtitles when
 *                           the audio is in another language);
 *   tiagotv.lite.audio      a two-letter language; missing means the
 *                           file's own default track.
 *
 * A TV whose storage refuses the write keeps the choice for the session.
 */
export const SUBTITLES_KEY = 'tiagotv.lite.subtitles';
export const AUDIO_KEY = 'tiagotv.lite.audio';
export const DEFAULT_SUBTITLES = 'es';

const session: Record<string, string> = {};

function storage(): StorageLike | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function read(key: string): string {
    if (session[key] !== undefined) {
        return session[key];
    }
    try {
        return storage()?.getItem(key) ?? '';
    } catch {
        return '';
    }
}

function write(key: string, value: string): void {
    session[key] = value;
    try {
        storage()?.setItem(key, value);
    } catch {
        // Full or blocked: the choice lasts until the app closes.
    }
}

/** "off", or the language subtitles are shown in. */
export function subtitlePreference(): string {
    const value = read(SUBTITLES_KEY);
    return value === 'off' ? 'off' : languageCode(value) || DEFAULT_SUBTITLES;
}

/** A track of no known language changes nothing for the next title. */
export function saveSubtitlePreference(language: string): void {
    const value = language === 'off' ? 'off' : languageCode(language);
    if (value) {
        write(SUBTITLES_KEY, value);
    }
}

/** The audio language to pick when a file has several, "" for its default. */
export function audioPreference(): string {
    return languageCode(read(AUDIO_KEY));
}

export function saveAudioPreference(language: string): void {
    const code = languageCode(language);
    if (code) {
        write(AUDIO_KEY, code);
    }
}
