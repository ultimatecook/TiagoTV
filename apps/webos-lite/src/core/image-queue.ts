import { activity, onActivity, type Activity } from './activity';

/**
 * Posters and logos download a few at a time, in the order the cards
 * appear: a row of 14 posters must not open 14 sockets next to a stream.
 * While the player covers the screen nothing new starts; a card that
 * leaves the screen gives up its place (`cancelImage`).
 */
const LIMIT: Readonly<Record<Activity, number>> = { idle: 4, preview: 2, fullscreen: 0 };

interface Job {
    readonly img: HTMLImageElement;
    readonly src: string;
}

const waiting: Job[] = [];
const loading = new Map<HTMLImageElement, () => void>();

function pump(): void {
    const limit = LIMIT[activity()];
    while (loading.size < limit && waiting.length > 0) {
        start(waiting.shift() as Job);
    }
}

function start(job: Job): void {
    const img = job.img;
    let finished = false;
    const done = () => {
        if (finished) {
            return;
        }
        finished = true;
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        loading.delete(img);
        pump();
    };
    loading.set(img, done);
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    img.src = job.src;
}

/** Sets `img.src` to `src` when its turn comes. */
export function queueImage(img: HTMLImageElement, src: string): void {
    waiting.push({ img, src });
    pump();
}

/** Drops `img` from the queue, or frees its place if it is loading. */
export function cancelImage(img: HTMLImageElement): void {
    for (let i = waiting.length - 1; i >= 0; i--) {
        if (waiting[i].img === img) {
            waiting.splice(i, 1);
        }
    }
    const done = loading.get(img);
    if (done) {
        done();
    }
}

/** For diagnostics: images waiting and loading. */
export function imageQueueSize(): { waiting: number; loading: number } {
    return { waiting: waiting.length, loading: loading.size };
}

onActivity(() => pump());
