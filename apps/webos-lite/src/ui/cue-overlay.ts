import { clear, h } from '../core/dom';
import { later, type Stop } from '../core/timers';

/**
 * The subtitles on screen, drawn by the app: white text on a dark band,
 * large enough to read from the sofa. The engine draws nothing itself
 * (the chosen embedded track is "hidden", a provider's file is parsed in
 * JS), so every source looks the same and nothing is drawn twice. The
 * lines follow the video's `timeupdate` and the chosen track's
 * `cuechange`; they move up while the OSD's progress bar shows.
 */
const NOTICE_MS = 3500;

export class CueOverlay {
    readonly el = h('div', 'cues');
    private shown = '';
    private track: TextTrack | null = null;
    private notice: Stop | null = null;
    private readonly draw = () => this.update();

    constructor(
        private readonly video: HTMLVideoElement,
        private readonly lines: () => string[]
    ) {
        for (const type of ['timeupdate', 'seeked', 'emptied']) {
            video.addEventListener(type, this.draw);
        }
    }

    /** Redraws at once when `track`'s cues change (an embedded track). */
    follow(track: TextTrack | null): void {
        if (track === this.track) {
            return;
        }
        this.track?.removeEventListener('cuechange', this.draw);
        this.track = track;
        track?.addEventListener('cuechange', this.draw);
    }

    update(): void {
        if (this.notice) {
            return;
        }
        const lines = this.lines();
        const text = lines.join('\n');
        if (text === this.shown) {
            return;
        }
        this.shown = text;
        clear(this.el);
        for (const line of lines) {
            this.el.appendChild(h('div', 'cues__cue', h('span', { className: 'cues__text', text: line })));
        }
    }

    /** A message where the subtitles go, for a few seconds. */
    say(text: string): void {
        this.stopNotice();
        clear(this.el);
        this.shown = '';
        this.el.appendChild(h('div', 'cues__cue', h('span', { className: 'cues__text cues__text--notice', text })));
        this.notice = later('track-notice', NOTICE_MS, () => {
            this.notice = null;
            this.update();
        });
    }

    raise(raised: boolean): void {
        this.el.classList.toggle('is-raised', raised);
    }

    private stopNotice(): void {
        if (this.notice) {
            this.notice();
            this.notice = null;
        }
    }

    destroy(): void {
        this.stopNotice();
        this.follow(null);
        for (const type of ['timeupdate', 'seeked', 'emptied']) {
            this.video.removeEventListener(type, this.draw);
        }
    }
}
