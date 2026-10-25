import { every, type Stop } from '../core/timers';

/**
 * A live stream that stopped moving: `waiting` for data, or frozen on a
 * frame without saying so (webOS's pipeline does not always fire
 * `waiting`). Checked every 2 s, never per frame: the picture's time must
 * advance within STALL_MS unless the viewer paused it.
 */
export const STALL_MS = 8000;
const CHECK_MS = 2000;

export interface Clocked {
    readonly currentTime: number;
    readonly paused: boolean;
}

export class StallWatch {
    private stop: Stop | null = null;
    private lastTime = -1;
    private lastMove = 0;

    constructor(
        private readonly media: Clocked,
        private readonly now: () => number,
        private readonly onStall: () => void,
        private readonly limitMs = STALL_MS
    ) {}

    start(): void {
        this.end();
        this.lastTime = this.media.currentTime;
        this.lastMove = this.now();
        this.stop = every('stall-watch', CHECK_MS, () => this.check());
    }

    end(): void {
        if (this.stop) {
            this.stop();
            this.stop = null;
        }
    }

    private check(): void {
        const time = this.media.currentTime;
        const now = this.now();
        if (this.media.paused || time !== this.lastTime) {
            this.lastTime = time;
            this.lastMove = now;
            return;
        }
        if (now - this.lastMove >= this.limitMs) {
            this.end();
            this.onStall();
        }
    }
}
