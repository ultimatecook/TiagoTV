import { setActivity } from '../core/activity';
import { clear, h } from '../core/dom';
import { clockTime } from '../core/format';
import type { Action } from '../core/keys';
import type { Screen } from '../core/screens';
import type { App, PlayItem } from '../app';
import { ZAP_DELAY_MS, type PlaybackController, type PlayState, type PlayView } from '../player/controller';
import { Osd } from '../ui/osd';
import { decodeEpgText, type XtreamEpgListing } from '../xtream/client';

/**
 * The full-screen player. Live: up/down and CH+/CH- zap along the row it
 * opened from, the OSD shows the channel and its programme for 3 s, OK
 * shows it again. Movies and episodes: left/right seek, play/pause keys,
 * and the position is kept for "Continuar". Back (or Stop) leaves; the
 * one stream is always closed first, unless the stream came from En
 * vivo's stage, which takes it back.
 *
 * While it shows, the screens below are display: none (ScreenStack) and
 * the app is "fullscreen" (core/activity.ts): no image downloads, no
 * catalog requests, no page timers.
 */
const SEEK_S = 10;
const JUMP_S = 30;

export interface PlayerScreenOptions {
    /** The stream belongs to someone else (the stage): hand it back. */
    readonly onExit?: (controller: PlaybackController) => void;
}

function span(entry: XtreamEpgListing): string {
    const start = Number(entry.start_timestamp) * 1000;
    const stop = Number(entry.stop_timestamp) * 1000;
    return start && stop ? ` · ${clockTime(new Date(start))}–${clockTime(new Date(stop))}` : '';
}

export class PlayerScreen implements Screen, PlayView {
    readonly el: HTMLElement;
    private readonly osd = new Osd();
    private readonly message = h('div', 'player__message');
    private readonly video: HTMLVideoElement;
    private programmeFor: PlayItem | null = null;
    private started = false;
    private readonly onTime = () => this.tick();
    private readonly onEnded = () => {
        if (!this.controller.ended()) {
            this.app.stack.pop();
        }
    };

    constructor(
        private readonly app: App,
        private readonly controller: PlaybackController,
        private readonly options: PlayerScreenOptions = {}
    ) {
        this.video = controller.video;
        this.el = h('div', 'screen player', this.video, this.osd.el, this.message);
        this.message.style.display = 'none';
        this.video.addEventListener('timeupdate', this.onTime);
        this.video.addEventListener('ended', this.onEnded);
    }

    initialFocus(): HTMLElement | null {
        return null;
    }

    onShow(): void {
        setActivity('fullscreen');
        // The video may come from the stage: it lives here now.
        if (this.video.parentNode !== this.el) {
            this.el.insertBefore(this.video, this.el.firstChild);
        }
        if (this.started) {
            return;
        }
        this.started = true;
        this.controller.attach(this);
        if (!this.options.onExit) {
            void this.controller.start(this.controller.request.startAt ?? 0);
        }
    }

    destroy(): void {
        this.osd.destroy();
        this.video.removeEventListener('timeupdate', this.onTime);
        this.video.removeEventListener('ended', this.onEnded);
        if (this.options.onExit) {
            this.options.onExit(this.controller);
        } else {
            this.controller.close();
            setActivity('idle');
        }
    }

    onBack(): boolean {
        return false;
    }

    showItem(item: PlayItem, index: number, count: number): void {
        this.programmeFor = null;
        this.osd.render(item, index, count);
        this.osd.show(true);
    }

    showState(state: PlayState, title: string, hint: string): void {
        clear(this.message);
        this.message.style.display = title ? '' : 'none';
        if (title) {
            this.message.appendChild(h('div', { className: 'player__message-title', text: title }));
            if (hint) {
                this.message.appendChild(h('div', { className: 'player__message-hint', text: hint }));
            }
        }
        if (state === 'playing') {
            this.osd.show(false);
            const item = this.controller.item;
            if (item.kind === 'live' && this.programmeFor !== item) {
                this.programmeFor = item;
                void this.loadProgramme(item);
            }
        } else if (this.controller.failed) {
            this.osd.show(true, true);
        }
    }

    private async loadProgramme(item: PlayItem): Promise<void> {
        try {
            const listings = await this.app.client.shortEpg(item.id, 2);
            if (this.controller.item !== item || listings.length === 0) {
                return;
            }
            const [now, next] = listings;
            const lines = [`Ahora: ${decodeEpgText(now.title)}${span(now)}`];
            if (next) {
                lines.push(`Después: ${decodeEpgText(next.title)}`);
            }
            this.osd.setSubtitle(lines.join(' · '));
        } catch {
            // No guide for this channel: the OSD keeps its name.
        }
    }

    private tick(): void {
        this.controller.tick();
        if (!this.controller.isLive) {
            const duration = Number.isFinite(this.video.duration)
                ? this.video.duration
                : this.controller.item.duration ?? 0;
            this.osd.setProgress(this.video.currentTime || 0, duration);
        }
    }

    private seek(seconds: number): void {
        if (this.controller.isLive || this.controller.state !== 'playing') {
            return;
        }
        const duration = Number.isFinite(this.video.duration) ? this.video.duration : Infinity;
        this.video.currentTime = Math.max(0, Math.min(duration - 1, this.video.currentTime + seconds));
        this.osd.show(true);
        this.tick();
    }

    private togglePause(force?: 'play' | 'pause'): void {
        const pause = force ? force === 'pause' : !this.video.paused;
        if (pause) {
            this.video.pause();
            this.controller.save();
            this.osd.show(true, true);
        } else {
            const playing = this.video.play() as Promise<void> | undefined;
            if (playing && typeof playing.then === 'function') {
                playing.then(undefined, () => undefined);
            }
            this.osd.show(true);
        }
        this.tick();
    }

    private zap(forward: boolean, channelKey: boolean): void {
        const controller = this.controller;
        if (controller.count > 1 && (controller.isLive || channelKey)) {
            controller.go(controller.index + (forward ? 1 : -1), controller.isLive ? ZAP_DELAY_MS : 0);
        } else {
            this.osd.show(true);
        }
    }

    onKey(action: Action): boolean {
        switch (action) {
            case 'ok':
                if (this.controller.failed) {
                    this.controller.retry();
                } else {
                    this.osd.show(!this.osd.shown);
                    this.tick();
                }
                return true;
            case 'info':
                this.osd.show(true);
                return true;
            case 'up':
            case 'down':
                this.zap(action === 'up', false);
                return true;
            case 'channelUp':
            case 'channelDown':
                this.zap(action === 'channelUp', true);
                return true;
            case 'left':
            case 'right':
                this.seek(action === 'right' ? SEEK_S : -SEEK_S);
                return true;
            case 'forward':
            case 'rewind':
                this.seek(action === 'forward' ? JUMP_S : -JUMP_S);
                return true;
            case 'play':
            case 'pause':
                this.togglePause(action);
                return true;
            case 'playPause':
                this.togglePause();
                return true;
            case 'stop':
                this.app.stack.pop();
                return true;
            default:
                return false;
        }
    }
}
