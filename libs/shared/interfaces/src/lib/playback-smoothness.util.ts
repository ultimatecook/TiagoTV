import {
    type AudioLanguagePreference,
    embeddedMpvAudioLanguageOptions,
} from './audio-language.util';
import {
    normalizeEmbeddedMpvExtraOptions,
    parseEmbeddedMpvExtraOptions,
} from './embedded-mpv-extra-options.util';

/**
 * Settings > Playback > "Fluidez". `stable` ("Más estable") trades a few
 * seconds of start-up and live delay for fewer stalls: bigger buffers on
 * every engine, and a channel that comes in several copies starts on its
 * HD copy before its UHD/4K one. `normal` keeps the engines' stock
 * buffering and the best copy first, as before the setting existed.
 *
 * `stable` is the default, also for settings saved before the choice
 * existed: only an explicit `normal` opts out.
 */
export type PlaybackSmoothness = 'stable' | 'normal';

export const PLAYBACK_SMOOTHNESS_VALUES: readonly PlaybackSmoothness[] = [
    'stable',
    'normal',
];

export const DEFAULT_PLAYBACK_SMOOTHNESS: PlaybackSmoothness = 'stable';

/** A missing or unknown value is the default, `stable`. */
export function normalizePlaybackSmoothness(
    value: unknown
): PlaybackSmoothness {
    return value === 'normal' ? 'normal' : DEFAULT_PLAYBACK_SMOOTHNESS;
}

/** Whether a channel starts on its HD copy rather than its UHD/4K one. */
export function prefersHdCopies(smoothness: unknown): boolean {
    return normalizePlaybackSmoothness(smoothness) === 'stable';
}

/**
 * Embedded MPV options "Más estable" adds to a session. With the cache on
 * (mpv already enables it for network streams), playback starts only once
 * 3 s are buffered and, after an underrun, resumes only once 3 s are
 * buffered again, instead of on the first packet (1 s by default), which
 * leaves a few seconds of cushion behind the live edge. The demuxer may
 * read ahead up to 150 MiB, keeping 50 MiB behind; `cache-secs` is left
 * alone because any value only limits that read-ahead. Hardware decoding
 * uses mpv's safe list.
 */
export const EMBEDDED_MPV_STABLE_OPTIONS: readonly string[] = [
    'cache=yes',
    'demuxer-readahead-secs=20',
    'demuxer-max-bytes=150MiB',
    'demuxer-max-back-bytes=50MiB',
    'cache-pause-initial=yes',
    'cache-pause-wait=3',
    'hwdec=auto-safe',
];

/**
 * The extra options the main process applies to the next embedded MPV
 * session: the user's own lines (canonical text), then, in `stable`, every
 * stability option whose key the user did not set, then the audio
 * language's track choice (`embeddedMpvAudioLanguageOptions`) for the keys
 * the user did not set either, so a user line always wins. `normal` adds no
 * stability option. On Linux `hwdec` is left to the engine: its native-view
 * embed renders through `vo=x11` and turns hardware decoding off on purpose.
 * Without `audioLanguage` (callers from before the setting) no track choice
 * is added.
 */
export function resolveEmbeddedMpvSessionExtraOptions(
    userOptions: string | null | undefined,
    smoothness: PlaybackSmoothness,
    platform?: string,
    audioLanguage?: AudioLanguagePreference
): string {
    const own = normalizeEmbeddedMpvExtraOptions(userOptions);
    const ownKeys = new Set(
        parseEmbeddedMpvExtraOptions(userOptions).map((option) => option.key)
    );
    const keyOf = (line: string) => line.slice(0, line.indexOf('='));
    const stability =
        smoothness === 'stable'
            ? EMBEDDED_MPV_STABLE_OPTIONS.filter(
                  (line) => !(keyOf(line) === 'hwdec' && platform === 'linux')
              )
            : [];
    const language = audioLanguage
        ? embeddedMpvAudioLanguageOptions(audioLanguage)
        : [];
    const added = [...stability, ...language].filter(
        (line) => !ownKeys.has(keyOf(line))
    );
    return [own, ...added].filter(Boolean).join('\n');
}
