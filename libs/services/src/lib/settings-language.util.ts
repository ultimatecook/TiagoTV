import {
    normalizeAudioLanguage,
    normalizeOpenSubtitlesSettings,
    type Settings,
} from '@iptvnator/shared/interfaces';

type LanguageSettings = Required<
    Pick<Settings, 'audioLanguage' | 'openSubtitles'>
>;

/**
 * The audio language and OpenSubtitles settings, whatever release stored
 * them: a missing audio language is `original`, a missing account is empty
 * with Spanish subtitles searched automatically.
 */
export function resolveLanguageSettings(
    stored: Partial<Settings>
): LanguageSettings {
    return {
        audioLanguage: normalizeAudioLanguage(stored.audioLanguage),
        openSubtitles: normalizeOpenSubtitlesSettings(stored.openSubtitles),
    };
}

/** Only the language settings the caller supplied, normalized the same way. */
export function coerceProvidedLanguageSettings(
    settings: Partial<Settings>
): Partial<LanguageSettings> {
    const resolved = resolveLanguageSettings(settings);
    return {
        ...(settings.audioLanguage !== undefined
            ? { audioLanguage: resolved.audioLanguage }
            : {}),
        ...(settings.openSubtitles !== undefined
            ? { openSubtitles: resolved.openSubtitles }
            : {}),
    };
}
