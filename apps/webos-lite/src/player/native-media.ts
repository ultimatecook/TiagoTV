import type { NativeSession, PlayOptions } from './engine';
import type { NativeBridge, NativeEvent, NativeTrackInfo } from './native-bridge';
import type { Candidate } from './sources';

/**
 * The Android app's native player as the page sees it: a `<div>` in the
 * video's place that quacks like the `<video>` for everything the player
 * uses (currentTime, duration, paused, play(), pause(), textTracks,
 * audioTracks and the media events the screen, the tracks and the stall
 * watch listen for), fed by the bridge's events (native-bridge.ts). The
 * engine starts and stops streams through it (its NativeSession).
 *
 * Embedded subtitles are drawn by the native player itself (the chosen
 * track is "hidden" here, as a `<video>`'s would be, and selected there);
 * the provider's subtitle files stay the page's (cue-overlay.ts).
 */
type Listener = () => void;

interface TrackList<T> {
    readonly length: number;
    readonly [index: number]: T;
    addEventListener(type: string, listener: Listener): void;
    removeEventListener(type: string, listener: Listener): void;
}

class NativeList<T> implements TrackList<T> {
    [index: number]: T;
    length = 0;
    private readonly listeners: Record<string, Listener[]> = {};

    set(entries: readonly T[]): void {
        for (let i = 0; i < this.length; i++) {
            delete this[i];
        }
        entries.forEach((entry, index) => {
            this[index] = entry;
        });
        this.length = entries.length;
    }

    addEventListener(type: string, listener: Listener): void {
        (this.listeners[type] = this.listeners[type] ?? []).push(listener);
    }

    removeEventListener(type: string, listener: Listener): void {
        const list = this.listeners[type] ?? [];
        const index = list.indexOf(listener);
        if (index >= 0) {
            list.splice(index, 1);
        }
    }

    fire(type: string): void {
        (this.listeners[type] ?? []).slice().forEach((listener) => listener());
    }
}

/** A track's `language` and `label` as the tracks read them. */
function describe(info: NativeTrackInfo): { language: string; label: string } {
    const label = String(info.label ?? '');
    return {
        language: String(info.language ?? ''),
        label: info.forced && !/forced|forzad/i.test(label) ? `${label} forced`.trim() : label,
    };
}

class NativeTextTrack {
    readonly kind = 'subtitles';
    language = '';
    label = '';
    /** The native player keeps its cues: none to read here. */
    readonly cues = null;

    constructor(
        readonly id: string,
        private readonly owner: NativeMedia
    ) {}

    get mode(): TextTrackMode {
        return this.owner.chosenText === this.id ? 'hidden' : 'disabled';
    }

    set mode(value: TextTrackMode) {
        this.owner.chooseText(this.id, value !== 'disabled');
    }

    addEventListener(): void {
        // No cuechange: the native player draws the cues.
    }

    removeEventListener(): void {
        // Nothing was registered.
    }
}

class NativeAudioTrack {
    language = '';
    label = '';

    constructor(
        readonly id: string,
        private readonly owner: NativeMedia
    ) {}

    get enabled(): boolean {
        return this.owner.chosenAudio === this.id;
    }

    set enabled(value: boolean) {
        if (value) {
            this.owner.chooseAudio(this.id);
        }
    }
}

const MARK = '__nativeMedia';

/** The facade behind a media element, if it is the native player's. */
export function nativeMediaOf(media: object): NativeMedia | null {
    return (media as Record<string, unknown>)[MARK] instanceof NativeMedia
        ? ((media as Record<string, unknown>)[MARK] as NativeMedia)
        : null;
}

export class NativeMedia implements NativeSession {
    /** The element in the video's place (typed as the video it stands for). */
    readonly el: HTMLVideoElement;
    readonly textTracks = new NativeList<NativeTextTrack>();
    readonly audioTracks = new NativeList<NativeAudioTrack>();
    chosenText: string | null = null;
    chosenAudio: string | null = null;
    private currentTime = 0;
    private duration = NaN;
    private paused = true;
    private status: number | null = null;
    private attached = false;
    private readonly texts = new Map<string, NativeTextTrack>();
    private readonly audios = new Map<string, NativeAudioTrack>();

    constructor(private readonly bridge: NativeBridge) {
        const el = document.createElement('div');
        el.className = 'player__video player__video--native';
        Object.defineProperties(el, {
            [MARK]: { value: this },
            currentTime: {
                get: () => this.currentTime,
                set: (value: number) => this.seek(value),
            },
            duration: { get: () => this.duration },
            paused: { get: () => this.paused },
            src: { get: () => '', set: () => undefined },
            textTracks: { get: () => this.textTracks },
            audioTracks: { get: () => this.audioTracks },
            play: { value: () => this.resume() },
            pause: { value: () => this.pause() },
            load: { value: () => undefined },
        });
        this.el = el as unknown as HTMLVideoElement;
    }

    start(candidate: Candidate, options: PlayOptions): void {
        this.attached = true;
        this.status = null;
        this.currentTime = options.startAt ?? 0;
        this.duration = NaN;
        this.paused = false;
        this.resetTracks();
        this.bridge.setProfile(options.profile ?? 'stable');
        this.bridge.play(candidate.url, candidate.format ?? 'file', options.startAt ?? 0);
    }

    stop(): void {
        if (!this.attached) {
            return;
        }
        this.attached = false;
        this.paused = true;
        this.bridge.stop();
        this.resetTracks();
        this.emit('emptied');
    }

    errorStatus(): number | null {
        return this.status;
    }

    setSubtitlesRaised(raised: boolean): void {
        this.bridge.setSubtitlesRaised(raised);
    }

    private resume(): Promise<void> {
        if (this.attached) {
            this.paused = false;
            this.bridge.resume();
        }
        return Promise.resolve();
    }

    private pause(): void {
        if (this.attached) {
            this.paused = true;
            this.bridge.pause();
        }
    }

    private seek(seconds: number): void {
        if (this.attached && Number.isFinite(seconds)) {
            this.currentTime = Math.max(0, seconds);
            this.bridge.seek(this.currentTime);
        }
    }

    chooseText(id: string, on: boolean): void {
        if (on && this.chosenText !== id) {
            this.chosenText = id;
            this.bridge.selectSubtitle(id);
        } else if (!on && this.chosenText === id) {
            this.chosenText = null;
            this.bridge.selectSubtitle('');
        }
    }

    chooseAudio(id: string): void {
        if (this.chosenAudio !== id) {
            this.chosenAudio = id;
            this.bridge.selectAudio(id);
        }
    }

    private resetTracks(): void {
        this.texts.clear();
        this.audios.clear();
        this.chosenText = null;
        this.chosenAudio = null;
        this.textTracks.set([]);
        this.audioTracks.set([]);
    }

    /** The native player's lists: the same objects for the same ids. */
    private readTracks(event: NativeEvent): void {
        const texts = (event.text ?? []).map((info) => {
            const track = this.texts.get(info.id) ?? new NativeTextTrack(info.id, this);
            this.texts.set(info.id, track);
            Object.assign(track, describe(info));
            return track;
        });
        const audios = (event.audio ?? []).map((info) => {
            const track = this.audios.get(info.id) ?? new NativeAudioTrack(info.id, this);
            this.audios.set(info.id, track);
            Object.assign(track, describe(info));
            return track;
        });
        const selectedText = (event.text ?? []).find((info) => info.selected);
        const selectedAudio = (event.audio ?? []).find((info) => info.selected);
        this.chosenText = selectedText ? selectedText.id : null;
        this.chosenAudio = selectedAudio ? selectedAudio.id : null;
        this.textTracks.set(texts);
        this.audioTracks.set(audios);
        this.textTracks.fire('change');
        this.audioTracks.fire('change');
    }

    private emit(type: string): void {
        this.el.dispatchEvent(new Event(type));
    }

    /** An event from the native player (window.__tiagotvNativeEvent). */
    handle(event: NativeEvent): void {
        if (!this.attached && event.type !== 'tracks') {
            return;
        }
        if (typeof event.currentTime === 'number') {
            this.currentTime = event.currentTime;
        }
        if (event.duration !== undefined) {
            this.duration = typeof event.duration === 'number' && event.duration > 0 ? event.duration : Infinity;
        }
        switch (event.type) {
            case 'ready':
                this.emit('loadedmetadata');
                this.emit('durationchange');
                return;
            case 'playing':
                this.paused = false;
                this.emit('playing');
                return;
            case 'paused':
                this.paused = true;
                this.emit('pause');
                return;
            case 'ended':
                this.paused = true;
                this.emit('ended');
                return;
            case 'error':
                this.status = typeof event.status === 'number' && event.status > 0 ? event.status : null;
                this.emit('error');
                return;
            case 'tracks':
                this.readTracks(event);
                return;
            default:
                this.emit(event.type);
        }
    }
}
