/**
 * The app's timers, by name: a page's clock, the hero's rotation, a
 * board's refresh. A screen behind the player must leave none running
 * (the 2019 TV's one CPU decodes the stream), and `activeTimers()` lets
 * the smoke run and ares-inspect check it (window.__tiagotv.timers()).
 *
 * Every handle stops its timer when called, any number of times.
 */
export type Stop = () => void;

const running = new Map<number, string>();
let nextId = 1;

/** Runs `run` every `ms` until stopped. */
export function every(name: string, ms: number, run: () => void): Stop {
    const id = nextId++;
    const timer = setInterval(run, ms);
    running.set(id, name);
    return () => {
        clearInterval(timer);
        running.delete(id);
    };
}

/** Runs `run` once after `ms`, unless stopped first. */
export function later(name: string, ms: number, run: () => void): Stop {
    const id = nextId++;
    const timer = setTimeout(() => {
        running.delete(id);
        run();
    }, ms);
    running.set(id, name);
    return () => {
        clearTimeout(timer);
        running.delete(id);
    };
}

/** The names of the timers that are set now. */
export function activeTimers(): string[] {
    const names: string[] = [];
    running.forEach((name) => names.push(name));
    return names.sort();
}

/** Holds at most one pending timer: setting a new one stops the old. */
export class Slot {
    private stop: Stop | null = null;

    constructor(private readonly name: string) {}

    later(ms: number, run: () => void): void {
        this.clear();
        this.stop = later(this.name, ms, () => {
            this.stop = null;
            run();
        });
    }

    clear(): void {
        if (this.stop) {
            this.stop();
            this.stop = null;
        }
    }

    get pending(): boolean {
        return this.stop !== null;
    }
}
