import { setActivity } from '../core/activity';
import { clear, h, toggleClass } from '../core/dom';
import { later, type Stop } from '../core/timers';
import type { App, PlayItem, PlayRequest } from '../app';
import { PlaybackController, type PlayState, type PlayView } from '../player/controller';
import { PlayerScreen } from '../screens/player-screen';

/**
 * The player behind En vivo and a league's page, as on the desktop: the
 * stream fills the screen under the page, the channel's name and line
 * over its foot. OK on the playing card goes full screen (the same
 * stream, no new connection) and Back comes back here. Leaving the page,
 * or the TV going to the background, closes the stream.
 */
const IDLE_MS = 10000;

/** The stages with a stream (at most one: the account has one connection). */
const playingStages: Stage[] = [];

/** Whether a page's stage holds a stream (the activity is "preview" then). */
export function stagePlaying(): boolean {
    return playingStages.length > 0;
}

function markPlaying(stage: Stage, playing: boolean): void {
    const index = playingStages.indexOf(stage);
    if (playing && index < 0) {
        playingStages.push(stage);
    } else if (!playing && index >= 0) {
        playingStages.splice(index, 1);
    }
}

export interface StageHost {
    /** The playing item changed (zapping): mark its card. */
    onItem(item: PlayItem, index: number): void;
    /** The page's chrome hides over an idle picture, and comes back. */
    setBare(bare: boolean): void;
}

export class Stage implements PlayView {
    readonly el = h('div', 'stage');
    readonly title = h('div', 'stage__title');
    readonly subtitle = h('div', 'stage__subtitle');
    private readonly message = h('div', 'stage__message');
    private controller: PlaybackController | null = null;
    private fullscreen = false;
    private idle: Stop | null = null;
    private bare = false;

    constructor(
        private readonly app: App,
        private readonly host: StageHost
    ) {
        this.el.appendChild(this.message);
        this.message.style.display = 'none';
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.fullscreen) {
                this.stop();
            }
        });
    }

    get playing(): PlaybackController | null {
        return this.controller;
    }

    /** Plays `request` here, or goes full screen if it already plays. */
    play(request: PlayRequest): void {
        const current = this.controller;
        const item = request.items[request.index];
        if (current && current.item.id === item.id && current.state === 'playing') {
            this.goFullscreen();
            return;
        }
        if (current) {
            current.close();
        }
        const controller = new PlaybackController(this.app, this.app.engine, request);
        this.controller = controller;
        this.el.insertBefore(controller.video, this.el.firstChild);
        markPlaying(this, true);
        setActivity('preview');
        controller.attach(this);
        void controller.start(0);
        this.wake();
    }

    /** CH+/CH-: along the row that plays. */
    zap(delta: number, delay: number): boolean {
        const controller = this.controller;
        if (!controller || controller.count < 2) {
            return false;
        }
        controller.go(controller.index + delta, delay);
        return true;
    }

    retry(): boolean {
        if (this.controller && this.controller.failed) {
            this.controller.retry();
            return true;
        }
        return false;
    }

    stop(): void {
        this.sleepTimer();
        if (this.controller) {
            this.controller.close();
            this.controller = null;
            markPlaying(this, false);
            setActivity('idle');
        }
        toggleClass(this.el, 'is-playing', false);
        this.setBare(false);
    }

    private goFullscreen(): void {
        const controller = this.controller;
        if (!controller) {
            return;
        }
        this.fullscreen = true;
        this.sleepTimer();
        this.app.stack.push(
            new PlayerScreen(this.app, controller, {
                onExit: (back) => {
                    this.fullscreen = false;
                    this.el.insertBefore(back.video, this.el.firstChild);
                    setActivity('preview');
                    back.attach(this);
                    this.wake();
                },
            })
        );
    }

    /** Whether the page is handing its stream to the full screen. */
    get handingOff(): boolean {
        return this.fullscreen;
    }

    showItem(item: PlayItem, index: number): void {
        this.title.textContent = item.title;
        this.subtitle.textContent = item.subtitle ?? '';
        this.host.onItem(item, index);
    }

    showState(state: PlayState, title: string, hint: string): void {
        toggleClass(this.el, 'is-playing', state === 'playing');
        clear(this.message);
        this.message.style.display = title ? '' : 'none';
        if (title) {
            this.message.appendChild(h('div', { className: 'stage__message-title', text: title }));
            if (hint) {
                this.message.appendChild(h('div', { className: 'stage__message-hint', text: hint }));
            }
        }
    }

    /** A key: the chrome comes back; true if it was hidden (the key is spent). */
    wake(): boolean {
        const wasBare = this.bare;
        this.setBare(false);
        this.sleepTimer();
        if (this.controller) {
            this.idle = later('live-idle', IDLE_MS, () => {
                this.idle = null;
                if (this.controller && this.controller.state === 'playing') {
                    this.setBare(true);
                }
            });
        }
        return wasBare;
    }

    private setBare(bare: boolean): void {
        if (bare !== this.bare) {
            this.bare = bare;
            this.host.setBare(bare);
        }
    }

    private sleepTimer(): void {
        if (this.idle) {
            this.idle();
            this.idle = null;
        }
    }
}
