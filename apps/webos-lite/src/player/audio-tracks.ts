import { t } from '../data/strings';
import { describeTrack } from './languages';
import { audioPreference, saveAudioPreference } from './track-prefs';

/**
 * The file's audio tracks (`video.audioTracks`, which webOS's engine
 * has and lists with two-letter languages), switched with `enabled`: the
 * source is never reloaded. The language wanted (the last one chosen, or
 * the file's default) is applied again to a reconnected stream's tracks.
 */
export interface TrackOption {
    readonly id: string;
    readonly name: string;
    readonly language: string;
}

export interface AudioTrackLike {
    readonly language: string;
    readonly label: string;
    enabled: boolean;
}

export interface TrackListLike<T> {
    readonly length: number;
    readonly [index: number]: T;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
}

/** "Inglés", "Inglés 2"…; a track of no language reads "Audio 1". */
export function named<T extends { name: string }>(entries: T[], fallback: (index: number) => string): T[] {
    const seen: Record<string, number> = {};
    return entries.map((entry, index) => {
        const base = entry.name || fallback(index + 1);
        seen[base] = (seen[base] ?? 0) + 1;
        return { ...entry, name: seen[base] > 1 ? `${base} ${seen[base]}` : base };
    });
}

export class AudioTracks {
    list: TrackListLike<AudioTrackLike> | null = null;
    private options: TrackOption[] = [];
    private readonly tracks = new Map<string, AudioTrackLike>();
    /** Tracks already switched to automatically (never twice). */
    private readonly tried = new Set<string>();
    private wanted = '';

    constructor(private readonly idOf: (track: object, prefix: string) => string) {}

    /** A new title: the language last chosen, if any. */
    reset(): void {
        this.wanted = audioPreference();
        this.tried.clear();
    }

    read(): readonly TrackOption[] {
        const list = this.list;
        const options: TrackOption[] = [];
        this.tracks.clear();
        for (let i = 0; list && i < list.length; i++) {
            const track = list[i];
            const about = describeTrack(track.language, track.label);
            const id = this.idOf(track, 'audio');
            this.tracks.set(id, track);
            options.push({ id, name: about.name, language: about.code });
        }
        this.options = named(options, (index) => t('EMBEDDED_MPV.PLAYER.AUDIO_TRACK_FALLBACK', { index }));
        return this.options;
    }

    get all(): readonly TrackOption[] {
        return this.options;
    }

    choice(): string | null {
        let id: string | null = null;
        this.tracks.forEach((track, key) => {
            if (!id && track.enabled) {
                id = key;
            }
        });
        return id;
    }

    /** The language of the track that plays, "" if unknown. */
    playingLanguage(): string {
        const id = this.choice();
        const option = id ? this.options.find((each) => each.id === id) : undefined;
        return option ? option.language : '';
    }

    /** The wanted language, when the file has it and it does not play. */
    applyWanted(): void {
        if (!this.wanted || this.options.length < 2 || this.playingLanguage() === this.wanted) {
            return;
        }
        const target = this.options.find((option) => option.language === this.wanted);
        if (target && !this.tried.has(target.id)) {
            this.tried.add(target.id);
            this.enable(target.id);
        }
    }

    /** The viewer's pick: remembered for the next titles. */
    choose(id: string): boolean {
        const option = this.options.find((each) => each.id === id);
        if (!option) {
            return false;
        }
        this.wanted = option.language;
        saveAudioPreference(option.language);
        this.enable(id);
        return true;
    }

    private enable(id: string): void {
        const target = this.tracks.get(id);
        if (!target) {
            return;
        }
        // The new one first: the file never has no audio at all.
        target.enabled = true;
        this.tracks.forEach((track) => {
            if (track !== target && track.enabled) {
                track.enabled = false;
            }
        });
    }
}
