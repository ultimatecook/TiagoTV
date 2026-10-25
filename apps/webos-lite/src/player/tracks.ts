import { getText, type RequestMeta } from '../core/http';
import { logRequest } from '../core/request-log';
import type { SubtitleSource } from '../data/media-info';
import { t } from '../data/strings';
import type { PlayItem } from '../app';
import { AudioTracks, named, type AudioTrackLike, type TrackListLike, type TrackOption } from './audio-tracks';
import { describeTrack, languageCode } from './languages';
import { cuesAt, parseSubtitles, plainCueText, type Cue } from './subtitle-file';
import { saveSubtitlePreference, subtitlePreference } from './track-prefs';

export type { TrackOption } from './audio-tracks';

/**
 * The playing file's subtitle and audio tracks, and which ones play:
 *
 *   - embedded subtitles: `video.textTracks`, the in-band tracks of an
 *     MKV, MP4 or HLS stream when the TV's engine exposes them. The one
 *     chosen is "hidden" (the engine keeps its cues and draws nothing),
 *     the app draws it (ui/cue-overlay.ts); the others are "disabled";
 *   - the provider's subtitle files: downloaded when chosen, parsed here;
 *   - audio: audio-tracks.ts.
 *
 * Nothing here touches the stream: a switch never reloads the source, so
 * the account's one connection (engine.ts) stays the one that plays.
 *
 * Choices wait for the title's own stream (its metadata, or "playing"):
 * a zap shows the next item before the previous source is emptied. Then,
 * until the viewer picks: the audio in the language last chosen;
 * subtitles in the preferred language (Spanish unless "off") when the
 * audio that plays is in another one (or forced ones when it is not).
 */
interface SubtitleEntry extends TrackOption {
    readonly forced: boolean;
    readonly track?: TextTrack;
    readonly file?: SubtitleSource;
}

export const OFF = 'off';
const FILE_TIMEOUT_MS = 15000;
const TEXT_KINDS = /^(subtitles|captions|)$/;
const LIST_EVENTS = ['addtrack', 'removetrack', 'change'];
const MEDIA_EVENTS = ['loadedmetadata', 'playing'];

let summary = 'Todavía no se reprodujo nada';

/** The last title's tracks, for Ajustes → Diagnóstico (no URLs). */
export function tracksSummary(): string {
    return summary;
}

export class MediaTracks {
    private item: PlayItem | null = null;
    private subtitles: SubtitleEntry[] = [];
    private chosen = OFF;
    /** The language picked by hand, to find again after a reconnect. */
    private picked: string | null = null;
    private armed = false;
    private readonly ids = new WeakMap<object, string>();
    private nextId = 1;
    private readonly audio = new AudioTracks((track, prefix) => this.idOf(track, prefix));
    private readonly files = new Map<string, Cue[] | 'loading' | 'failed'>();
    /** An embedded track's cues, copied when their count changes. */
    private snapshot: { track: TextTrack | null; count: number; cues: Cue[] } = { track: null, count: -1, cues: [] };
    private readonly refresher = () => this.refresh();
    private readonly arm = () => this.ready();
    private textList: TrackListLike<TextTrack> | null = null;
    /** The lists or the choices changed. */
    onChange: (() => void) | null = null;
    /** A short message for the viewer (a file that did not load). */
    onNotice: ((text: string) => void) | null = null;

    constructor(private readonly video: HTMLVideoElement) {
        MEDIA_EVENTS.forEach((type) => video.addEventListener(type, this.arm));
    }

    /** A new title: its provider files; choices wait for its stream. */
    setItem(item: PlayItem): void {
        this.item = item;
        this.chosen = OFF;
        this.picked = null;
        this.armed = false;
        this.audio.reset();
        this.files.clear();
        this.refresh();
    }

    /** The title's stream plays (or has its metadata): choose. */
    ready(): void {
        this.armed = true;
        this.refresh();
    }

    subtitleOptions(): readonly TrackOption[] {
        return this.subtitles;
    }

    audioOptions(): readonly TrackOption[] {
        return this.audio.all;
    }

    subtitleChoice(): string {
        return this.chosen;
    }

    audioChoice(): string | null {
        return this.audio.choice();
    }

    private idOf(target: object, prefix: string): string {
        let id = this.ids.get(target);
        if (!id) {
            id = `${prefix}${this.nextId++}`;
            this.ids.set(target, id);
        }
        return id;
    }

    /** Lists and engine events can change at any time: rebuilt from scratch. */
    refresh(): void {
        this.watch();
        const text = this.textList;
        const embedded: SubtitleEntry[] = [];
        for (let i = 0; text && i < text.length; i++) {
            const track = text[i];
            if (TEXT_KINDS.test(track.kind || '')) {
                const about = describeTrack(track.language, track.label);
                embedded.push({ id: this.idOf(track, 'tt'), name: about.name, language: about.code, forced: about.forced, track });
            }
        }
        const files = (this.item?.subtitles ?? []).map((file): SubtitleEntry => {
            const about = describeTrack(file.language, file.label);
            return { id: this.idOf(file, 'file'), name: about.name, language: about.code, forced: about.forced, file };
        });
        this.subtitles = named(embedded.concat(files), (index) => t('EMBEDDED_MPV.PLAYER.SUBTITLE_TRACK_FALLBACK', { index }));
        this.audio.read();
        if (this.armed) {
            // Live channels keep the tracks they start with: switching one
            // mid-stream can stall webOS's pipeline. The menu still works.
            const live = this.item?.kind === 'live';
            if (!live) {
                this.audio.applyWanted();
            }
            if (this.picked === null) {
                this.chosen = live ? OFF : this.pickSubtitles();
            } else if (!this.entry(this.chosen)) {
                // A reconnected stream has new tracks: the same language.
                const again = this.picked ? this.subtitles.find((entry) => entry.language === this.picked) : undefined;
                this.chosen = again ? again.id : OFF;
            }
        }
        this.applyModes();
        this.summarize();
        this.onChange?.();
    }

    /** The engine's lists, once they exist (some appear with the media). */
    private watch(): void {
        const media = this.video as unknown as { textTracks?: TrackListLike<TextTrack>; audioTracks?: TrackListLike<AudioTrackLike> };
        const text = media.textTracks ?? null;
        const audio = media.audioTracks ?? null;
        if (text !== this.textList) {
            this.unwatch(this.textList);
            this.textList = text;
            LIST_EVENTS.forEach((type) => text?.addEventListener(type, this.refresher));
        }
        if (audio !== this.audio.list) {
            this.unwatch(this.audio.list);
            this.audio.list = audio;
            LIST_EVENTS.forEach((type) => audio?.addEventListener(type, this.refresher));
        }
    }

    private unwatch(list: TrackListLike<unknown> | null): void {
        LIST_EVENTS.forEach((type) => list?.removeEventListener(type, this.refresher));
    }

    private entry(id: string): SubtitleEntry | undefined {
        return this.subtitles.find((entry) => entry.id === id);
    }

    private pickSubtitles(): string {
        const wanted = subtitlePreference();
        if (wanted === OFF) {
            return OFF;
        }
        const playing = this.audio.playingLanguage() || languageCode(this.item?.audioLanguage);
        const matches = this.subtitles.filter((entry) => entry.language === wanted);
        const pick =
            playing === wanted ? matches.find((entry) => entry.forced) : matches.find((entry) => !entry.forced) ?? matches[0];
        return pick ? pick.id : OFF;
    }

    /** The viewer's pick: remembered for the next titles. */
    chooseSubtitles(id: string): void {
        const entry = id === OFF ? undefined : this.entry(id);
        this.chosen = entry ? entry.id : OFF;
        this.picked = entry ? entry.language : '';
        saveSubtitlePreference(entry ? entry.language : OFF);
        this.applyModes();
        this.onChange?.();
    }

    chooseAudio(id: string): void {
        if (this.audio.choose(id)) {
            this.refresh();
        }
    }

    /** Only the chosen embedded track is read; a chosen file is loaded. */
    private applyModes(): void {
        for (const entry of this.subtitles) {
            if (entry.track) {
                const mode: TextTrackMode = entry.id === this.chosen ? 'hidden' : 'disabled';
                if (entry.track.mode !== mode) {
                    entry.track.mode = mode;
                }
            }
        }
        const entry = this.entry(this.chosen);
        if (entry?.file && !this.files.has(entry.file.url)) {
            this.load(entry.file, entry.name);
        }
    }

    private load(file: SubtitleSource, name: string): void {
        const item = this.item;
        const meta: RequestMeta = { bytes: 0 };
        const started = Date.now();
        this.files.set(file.url, 'loading');
        const done = (cues: Cue[], error: unknown) => {
            logRequest('subtítulos', name, started, meta.bytes, error ?? (cues.length > 0 ? null : new Error('empty')));
            if (this.item !== item) {
                return;
            }
            this.files.set(file.url, cues.length > 0 ? cues : 'failed');
            if (cues.length === 0) {
                this.onNotice?.('No se pudieron cargar estos subtítulos');
            }
        };
        getText(file.url, FILE_TIMEOUT_MS, meta).then(
            (content) => done(parseSubtitles(content), null),
            (error: unknown) => done([], error)
        );
    }

    /** The subtitle lines to show at the video's current time. */
    lines(): string[] {
        const entry = this.chosen === OFF ? undefined : this.entry(this.chosen);
        const time = this.video.currentTime || 0;
        if (entry?.file) {
            const cues = this.files.get(entry.file.url);
            return Array.isArray(cues) ? cuesAt(cues, time) : [];
        }
        return entry?.track ? cuesAt(this.embeddedCues(entry.track), time) : [];
    }

    /**
     * The engine adds an embedded track's cues as it reads the file: they
     * are copied (sorted, without markup) only when their count changes,
     * so each `timeupdate` is a binary search, not a walk of them all.
     */
    private embeddedCues(track: TextTrack): Cue[] {
        const list = track.cues;
        const count = list ? list.length : 0;
        if (this.snapshot.track !== track || this.snapshot.count !== count) {
            const cues: Cue[] = [];
            for (let i = 0; list && i < count; i++) {
                const text = plainCueText((list[i] as VTTCue).text || '');
                if (text) {
                    cues.push({ start: list[i].startTime, end: list[i].endTime, text });
                }
            }
            cues.sort((a, b) => a.start - b.start);
            this.snapshot = { track, count, cues };
        }
        return this.snapshot.cues;
    }

    /** The chosen embedded track (its cuechange redraws at once). */
    get chosenTrack(): TextTrack | null {
        return this.entry(this.chosen)?.track ?? null;
    }

    private summarize(): void {
        const codes = (options: readonly TrackOption[]) => options.map((option) => option.language || '?').join(', ') || 'ninguno';
        const embedded = this.subtitles.filter((entry) => entry.track);
        const audio = this.audio.list ? `${this.audio.all.length} (${codes(this.audio.all)})` : 'la tele no las informa';
        summary = `Audio: ${audio} · Subtítulos del archivo: ${codes(embedded)} · Del proveedor: ${this.subtitles.length - embedded.length}`;
    }

    destroy(): void {
        MEDIA_EVENTS.forEach((type) => this.video.removeEventListener(type, this.arm));
        this.unwatch(this.textList);
        this.unwatch(this.audio.list);
        this.textList = null;
        this.audio.list = null;
        this.onChange = null;
        this.onNotice = null;
        for (const entry of this.subtitles) {
            if (entry.track && entry.track.mode !== 'disabled') {
                entry.track.mode = 'disabled';
            }
        }
    }
}
