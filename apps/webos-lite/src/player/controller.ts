import { Slot } from '../core/timers';
import { recentChannels } from '../data/recent-channels';
import { resume } from '../data/resume';
import type { App, PlayItem, PlayRequest } from '../app';
import type { Outcome, PlayerEngine } from './engine';
import { loadFluidez } from './fluidez';
import { mseSupported } from './mpegts';
import { fileCandidates, liveCandidates, type Candidate } from './sources';
import { disableMediaOption, hlsMediaOptionType } from './webos-media';

/**
 * A row being played: which item, its stream's state, and what happens
 * when it breaks. The full-screen player and En vivo's stage show it
 * (views); the stream and its single connection belong to the engine.
 *
 *   - a stream that fails after playing reconnects (up to MAX_RECONNECTS);
 *   - a live picture frozen for STALL_MS reconnects once, then the error
 *     panel offers OK to retry;
 *   - zapping stops the stream at once and starts the new channel when
 *     the keys settle (ZAP_DELAY_MS), however fast the remote repeats.
 */
export type PlayState = 'starting' | 'playing' | 'reconnecting' | 'busy' | 'missing' | 'failed';

export interface PlayView {
    /** The item changed (opened, zapped, next episode). */
    showItem(item: PlayItem, index: number, count: number): void;
    showState(state: PlayState, title: string, hint: string): void;
}

export const ZAP_DELAY_MS = 450;
const SAVE_EVERY_S = 10;
const MAX_RECONNECTS = 3;
const MAX_STALL_RECONNECTS = 1;
const BUSY_GIVEN_UP = 'Si la Mac u otro equipo está reproduciendo, cerralo y apretá OK para reintentar.';
const RECONNECT_DELAY_MS = 2000;
/**
 * A busy account is tried again on its own: the provider can keep
 * counting a connection that already closed (this TV's, or the Mac's
 * after it slept) for a while.
 */
export const BUSY_AUTO_RETRY_MS = 15000;
export const BUSY_AUTO_RETRIES = 4;

const MESSAGES: Readonly<Record<'busy' | 'missing' | 'failed', [string, string]>> = {
    busy: [
        'La cuenta figura en uso',
        'Puede ser una conexión que quedó abierta. Se reintenta solo; OK para forzar ahora.',
    ],
    missing: ['Este canal no está disponible ahora', 'Probá con otro canal o más tarde.'],
    failed: [
        'No se pudo reproducir',
        'Apretá OK para reintentar, o cambiá la Fluidez en Ajustes.',
    ],
};

/** mpegts.js's first buffer: more margin when "Más estable". */
const STASH_BYTES = { stable: 2 * 1024 * 1024, normal: 1024 * 1024 } as const;

export class PlaybackController {
    index: number;
    state: PlayState = 'starting';
    private closed = false;
    private reconnects = 0;
    private stalls = 0;
    private busyRetries = 0;
    private lastSaved = 0;
    private readonly zap = new Slot('zap');
    private view: PlayView | null = null;

    constructor(
        private readonly app: App,
        readonly engine: PlayerEngine,
        readonly request: PlayRequest
    ) {
        this.index = request.index;
        engine.onBroken = () => this.broken();
        engine.onStall = () => this.stalled();
        engine.onAttemptFailed = (candidate) => {
            if (candidate.type) {
                disableMediaOption();
            }
        };
    }

    get item(): PlayItem {
        return this.request.items[this.index];
    }

    get isLive(): boolean {
        return this.item.kind === 'live';
    }

    get video(): HTMLVideoElement {
        return this.engine.media as unknown as HTMLVideoElement;
    }

    get count(): number {
        return this.request.items.length;
    }

    /** Shows the stream in `view` (the stage, then the full screen…). */
    attach(view: PlayView): void {
        this.view = view;
        view.showItem(this.item, this.index, this.count);
        this.report();
    }

    private report(): void {
        const state = this.state;
        if (!this.view) {
            return;
        }
        if (state === 'busy' && this.busyRetries >= BUSY_AUTO_RETRIES) {
            this.view.showState(state, MESSAGES.busy[0], BUSY_GIVEN_UP);
        } else if (state === 'busy' || state === 'missing' || state === 'failed') {
            this.view.showState(state, MESSAGES[state][0], MESSAGES[state][1]);
        } else if (state === 'reconnecting') {
            this.view.showState(state, 'Se cortó la señal. Reconectando…', '');
        } else {
            this.view.showState(state, state === 'starting' ? 'Conectando…' : '', '');
        }
    }

    private setState(state: PlayState): void {
        this.state = state;
        if (state === 'playing' && this.isLive) {
            // "Últimos canales vistos" on the Home.
            const item = this.item;
            recentChannels.add({
                id: item.id,
                title: item.title,
                logo: item.logo ?? null,
                subtitle: item.subtitle ?? null,
                country: item.country ?? null,
            });
        }
        this.report();
    }

    private candidates(item: PlayItem): Candidate[] {
        const client = this.app.client;
        const native = this.engine.isNative;
        if (item.kind === 'live') {
            return liveCandidates((ext) => client.liveUrl(item.id, ext), loadFluidez(), {
                mse: mseSupported(),
                hlsType: hlsMediaOptionType(),
                native,
            });
        }
        return fileCandidates(
            item.kind === 'movie'
                ? client.movieUrl(item.id, item.extension ?? 'mp4')
                : client.episodeUrl(item.id, item.extension ?? 'mp4'),
            native
        );
    }

    async start(startAt = 0, reconnecting = false): Promise<void> {
        const item = this.item;
        this.zap.clear();
        this.lastSaved = 0;
        this.setState(reconnecting ? 'reconnecting' : 'starting');
        const outcome: Outcome = await this.engine.play(this.candidates(item), {
            startAt,
            timeoutMs: item.kind === 'live' ? 12000 : 25000,
            busyRetries: item.kind === 'live' ? 1 : 0,
            live: item.kind === 'live',
            stashBytes: STASH_BYTES[loadFluidez()],
            profile: loadFluidez(),
        });
        if (this.closed || outcome.kind === 'cancelled') {
            return;
        }
        if (outcome.kind === 'playing') {
            this.reconnects = 0;
            this.busyRetries = 0;
        }
        this.setState(outcome.kind);
        if (outcome.kind === 'busy' && this.busyRetries < BUSY_AUTO_RETRIES) {
            this.busyRetries++;
            this.zap.later(BUSY_AUTO_RETRY_MS, () => {
                if (!this.closed && this.state === 'busy') {
                    void this.start(startAt);
                }
            });
        }
    }

    /** OK on the error panel: forces a new try at once. */
    retry(): void {
        this.reconnects = 0;
        this.stalls = 0;
        this.busyRetries = 0;
        void this.start(0);
    }

    get failed(): boolean {
        return this.state === 'busy' || this.state === 'missing' || this.state === 'failed';
    }

    private reconnect(): void {
        this.setState('reconnecting');
        void this.engine.stop();
        this.zap.later(RECONNECT_DELAY_MS, () => void this.start(0, true));
    }

    private broken(): void {
        if (this.closed || this.state !== 'playing') {
            return;
        }
        if (!this.isLive || this.reconnects >= MAX_RECONNECTS) {
            this.setState('failed');
            return;
        }
        this.reconnects++;
        this.reconnect();
    }

    private stalled(): void {
        if (this.closed || this.state !== 'playing') {
            return;
        }
        if (this.stalls >= MAX_STALL_RECONNECTS) {
            void this.engine.stop();
            this.setState('failed');
            return;
        }
        this.stalls++;
        this.reconnect();
    }

    /** Moves to item `index` of the row: zapping, or the next episode. */
    go(index: number, delay: number): void {
        this.save();
        const count = this.count;
        this.index = ((index % count) + count) % count;
        this.stalls = 0;
        this.reconnects = 0;
        this.busyRetries = 0;
        this.view?.showItem(this.item, this.index, count);
        // Stop at once (one connection), start once the keys settle.
        void this.engine.stop();
        this.setState('starting');
        this.zap.later(delay, () => {
            this.request.onIndexChange?.(this.index);
            const item = this.item;
            const kind = item.kind === 'movie' ? 'movie' : 'episode';
            void this.start(item.kind === 'live' ? 0 : resume.positionOf(kind, item.id));
        });
    }

    /** The stream ended: the next episode, or false when the row is over. */
    ended(): boolean {
        if (this.isLive) {
            this.broken();
            return true;
        }
        this.save();
        if (this.index + 1 < this.count) {
            this.go(this.index + 1, 0);
            return true;
        }
        return false;
    }

    /** The picture moved (timeupdate): keeps "Continuar" current. */
    tick(): void {
        if (this.state === 'playing' && Math.abs(this.video.currentTime - this.lastSaved) >= SAVE_EVERY_S) {
            this.save();
        }
    }

    save(): void {
        const item = this.item;
        if (item.kind === 'live' || this.state !== 'playing') {
            return;
        }
        const video = this.video;
        const duration = Number.isFinite(video.duration) ? video.duration : item.duration ?? 0;
        const position = video.currentTime || 0;
        this.lastSaved = position;
        resume.save({
            kind: item.kind,
            id: item.id,
            extension: item.extension ?? 'mp4',
            title: item.title,
            poster: item.poster ?? null,
            position,
            duration,
            seriesId: item.seriesId,
            seriesTitle: item.seriesTitle,
            season: item.season,
            episode: item.episode,
        });
    }

    /** Closes the stream and frees the connection. */
    close(): void {
        if (this.closed) {
            return;
        }
        this.save();
        this.closed = true;
        this.zap.clear();
        this.view = null;
        this.engine.onBroken = null;
        this.engine.onStall = null;
        this.engine.onAttemptFailed = null;
        void this.engine.stop();
    }
}
