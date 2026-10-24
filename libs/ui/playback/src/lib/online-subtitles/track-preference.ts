import {
    type AudioLanguagePreference,
    isEnglishLanguage,
    isSpanishLanguage,
} from '@iptvnator/shared/interfaces';
import type { PlayerTrack } from '../player-controls/player-controls.model';

/** A track's language as the engine tags it, else as its label names it. */
export function isSpanishTrack(track: PlayerTrack): boolean {
    return isSpanishLanguage(track.language) || isSpanishLanguage(track.label);
}

export function isEnglishTrack(track: PlayerTrack): boolean {
    return isEnglishLanguage(track.language) || isEnglishLanguage(track.label);
}

const FORCED = /forced|forzad|foreign|signs/i;

/** "Spanish (Forced)": a subtitle for on-screen text and foreign lines. */
export function isForcedTrack(track: PlayerTrack): boolean {
    return FORCED.test(track.label);
}

/**
 * The audio track the setting asks for in a file with several, or null to
 * keep the engine's choice. Original: English, else the first track that
 * is not Spanish (the dub); Español: the first Spanish one.
 */
export function preferredAudioTrack(
    tracks: readonly PlayerTrack[],
    preference: AudioLanguagePreference
): PlayerTrack | null {
    if (tracks.length < 2) {
        return null;
    }
    if (preference === 'es') {
        return tracks.find(isSpanishTrack) ?? null;
    }
    return (
        tracks.find(isEnglishTrack) ??
        tracks.find((track) => !isSpanishTrack(track)) ??
        null
    );
}

/**
 * What the setting does with the subtitles once the audio is chosen:
 * a track to select, `off` to turn a full subtitle off, or null to leave
 * them. Original: Spanish subtitles (a full track before a forced one)
 * whenever the audio is not known to be Spanish. Español: with Spanish
 * audio, a full subtitle the engine turned on goes off (forced ones stay).
 */
export function preferredSubtitleTrack(
    subtitles: readonly PlayerTrack[],
    audio: PlayerTrack | null,
    preference: AudioLanguagePreference
): PlayerTrack | 'off' | null {
    const spanishAudio = audio !== null && isSpanishTrack(audio);
    if (preference === 'es') {
        const shown = subtitles.find((track) => track.selected);
        return spanishAudio && shown && !isForcedTrack(shown) ? 'off' : null;
    }
    if (spanishAudio) {
        return null;
    }
    const spanish = subtitles.filter(isSpanishTrack);
    return spanish.find((track) => !isForcedTrack(track)) ?? spanish[0] ?? null;
}

/**
 * Whether a subtitle track is in an OpenSubtitles language: the Spanish
 * codes (`es`, `sp`, `ea`) match any Spanish track, `en` an English one,
 * the others by their tag's first letters ("pt-BR" → "pt…").
 */
export function matchesSubtitleLanguage(
    track: PlayerTrack,
    code: string
): boolean {
    const normalized = code.toLowerCase();
    if (['es', 'sp', 'ea'].includes(normalized)) {
        return isSpanishTrack(track) && !isForcedTrack(track);
    }
    if (normalized === 'en') {
        return isEnglishTrack(track) && !isForcedTrack(track);
    }
    const prefix = normalized.slice(0, 2);
    return (track.language ?? '').toLowerCase().startsWith(prefix);
}
