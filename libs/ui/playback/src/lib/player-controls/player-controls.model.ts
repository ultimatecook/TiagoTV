import type { Signal } from '@angular/core';
import type { PlayerSubtitleStyle } from '@iptvnator/shared/interfaces';
import type { PlayerStreamStatsSource } from './player-stream-stats.model';

export type PlayerStatus =
    'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

/** Which controls an engine supports. A control is only rendered when its flag is true. */
export interface PlayerControlsCapabilities {
    seek: boolean; // scrub bar / ±10s (VOD)
    volume: boolean;
    audioTracks: boolean;
    subtitles: boolean;
    /** Loading an external subtitle file (.srt/.vtt, mpv also .ass). */
    externalSubtitles: boolean;
    /** Adjusting the subtitle timing offset for the current playback. */
    subtitleDelay: boolean;
    /** Adjusting subtitle text size and color. */
    subtitleStyle: boolean;
    /** Manifest-driven: true only when the source exposes >1 video rendition. */
    qualityLevels: boolean;
    playbackSpeed: boolean;
    aspectRatio: boolean;
    recording: boolean;
    pictureInPicture: boolean;
    fullscreen: boolean;
    seriesNavigation: boolean;
    /** Engine can report live stream data (resolution, frame rate, bitrate). */
    streamStats: boolean;
}

// Canonical shape lives in @iptvnator/shared/interfaces so the Electron main
// process validates IPC payloads against the identical contract.
export type { PlayerSubtitleStyle };

export interface PlayerTrack {
    id: number;
    label: string; // adapter pre-computes the display label
    selected: boolean;
    /**
     * The track's language tag as the engine reports it ("es", "eng",
     * "es-419"), when it does; the audio-language preference reads it, and
     * the label when it is missing.
     */
    language?: string;
}

/** A subtitle the app holds as text (a downloaded one), to attach. */
export interface PlayerSubtitleFile {
    /** The track's label, and the file name mpv shows. */
    name: string;
    format: 'srt' | 'vtt';
    content: string;
    /** Its language tag, when known ("es"). */
    language?: string;
}

/**
 * Attaching a subtitle the app holds as text to the playing file
 * (OpenSubtitles). Web engines add a text track; Embedded MPV needs the
 * main-process bridge that writes a temp file, so it can say no up front:
 * nothing is downloaded that could not be shown.
 */
export interface PlayerSubtitleAttachment {
    canAttach(): boolean;
    /** Attaches and selects it; false when it could not be shown. */
    attach(file: PlayerSubtitleFile): Promise<boolean>;
}

/**
 * `setQualityLevel(AUTO_QUALITY_LEVEL_ID)` re-enables the engine's adaptive
 * (ABR) selection, mirroring how `setSubtitleTrack(-1)` means "off".
 */
export const AUTO_QUALITY_LEVEL_ID = -1;

/**
 * Content title lines rendered over the player while the controls are visible
 * in fullscreen. Hosts pass display-ready strings; the controls never derive
 * them from playback data.
 */
export interface PlayerMediaTitle {
    /** Movie title, channel name, or series name. */
    primary: string;
    /** Optional second line, e.g. the "S01E03" label for series episodes. */
    secondary?: string | null;
}

/**
 * One stretch of the timeline the track draws as its own segment — a chapter
 * of a film, a programme of a catch-up recording. Hosts pass display-ready
 * titles; the controls clamp, order and gap-fill the list themselves.
 */
export interface PlayerTimelineSegment {
    startSeconds: number;
    endSeconds: number;
    /** Shown in the hover label as `Title · 12:40`; null for a plain gap. */
    title: string | null;
}

/**
 * The episode after the current one, for the "Up next" card. Series hosts
 * build it from their episode list; the controls decide when to show it.
 */
export interface PlayerUpNextItem {
    /** `S01E03`. */
    label: string;
    title: string;
    thumbnailUrl: string | null;
    /** Watch progress in percent (0–100); null when never started. */
    progressPercent: number | null;
}

export interface PlayerPreset<T> {
    value: T;
    label: string;
}

export interface PlayerRecordingState {
    active: boolean;
    /** Seconds since recording started; adapter computes via a 1s tick. */
    elapsedSeconds: number;
    /** Persistent status text (e.g. "Saved to …" / error). null when none. */
    message: string | null;
    /** Changes when recording ownership moves to another playback/session. */
    transitionKey?: string | null;
}

export interface PlayerControlsState {
    status: PlayerStatus;
    /** Loading/error text for the player surface; '' when nothing to show. */
    statusMessage: string;
    stalled: boolean;
    positionSeconds: number;
    durationSeconds: number | null;
    isLive: boolean;
    canSeek: boolean;
    volume: number; // 0..1
    audioTracks: PlayerTrack[];
    subtitleTracks: PlayerTrack[];
    /** True when a subtitle track is active (selected id !== null/off). */
    subtitlesEnabled: boolean;
    /** Current subtitle timing offset; positive shows subtitles later. */
    subtitleDelaySeconds: number;
    /** Current subtitle presentation preferences. */
    subtitleStyle: PlayerSubtitleStyle;
    /**
     * Per-level quality options ("1080p", …). A level reports `selected` only
     * while a manual selection is active; with ABR on, none is selected.
     */
    qualityLevels: PlayerTrack[];
    /** True while the engine picks the quality level itself (ABR/auto). */
    qualityAutoEnabled: boolean;
    playbackSpeed: number;
    speedPresets: ReadonlyArray<PlayerPreset<number>>;
    aspectRatio: string;
    aspectPresets: ReadonlyArray<PlayerPreset<string>>;
    recording: PlayerRecordingState;
    pictureInPictureActive: boolean;
    canPictureInPicture: boolean;
    canPreviousEpisode: boolean;
    canNextEpisode: boolean;
}

/** Imperative command surface. All fire-and-forget (void). */
export interface PlayerControlsCommands {
    togglePlay(): void;
    seekTo(seconds: number): void;
    seekBy(deltaSeconds: number): void;
    setVolume(value: number): void; // 0..1
    setAudioTrack(id: number): void;
    setSubtitleTrack(id: number): void; // -1 = off
    /** Opens the engine's subtitle file picker; loads + selects the file. */
    addExternalSubtitleFile(): void;
    setSubtitleDelay(seconds: number): void;
    setSubtitleStyle(style: PlayerSubtitleStyle): void;
    setQualityLevel(id: number): void; // AUTO_QUALITY_LEVEL_ID (-1) = auto
    setPlaybackSpeed(speed: number): void;
    setAspectRatio(value: string): void;
    toggleRecording(): void;
    togglePictureInPicture(): void;
}

/**
 * What any engine implements to drive the shared controls. Intentionally has NO
 * component-lifecycle assumptions — a controller may live above the router
 * (background-playback readiness, subissue 04). Episode navigation and
 * fullscreen are NOT here: they are controls-component outputs / DOM affordances.
 */
export interface PlayerController {
    readonly capabilities: Signal<PlayerControlsCapabilities>;
    readonly state: Signal<PlayerControlsState>;
    readonly commands: PlayerControlsCommands;
    /**
     * Optional live stream diagnostics behind the controls' info popover.
     * Absent (or paired with a false `streamStats` capability) means the
     * engine reports nothing and the info button is not rendered.
     */
    readonly streamStats?: PlayerStreamStatsSource;
    /** Optional; see "Online subtitles" in the controls contract. */
    readonly subtitleAttachment?: PlayerSubtitleAttachment;
    /**
     * True when the engine picks the audio and subtitle tracks for the
     * audio-language setting itself (Embedded MPV's `alang`/`slang`), so the
     * app's own track preference leaves it alone.
     */
    readonly selectsLanguageTracks?: boolean;
}
