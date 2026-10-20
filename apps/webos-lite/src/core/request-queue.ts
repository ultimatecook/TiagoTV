import { activity, onActivity } from './activity';

/**
 * The provider's catalog requests, one at a time: the panel refuses
 * bursts, and its account allows a single connection. While the player
 * covers the screen, queued requests wait (a request already sent
 * finishes): the stream keeps the TV's network to itself. The player's
 * own calls (the account, the programme guide) go around the queue.
 *
 * A background request (the Home's catalog prefetch) waits behind every
 * request the viewer asked for: opening a title is never stuck behind
 * forty catalog categories.
 */
interface Job {
    readonly background: boolean;
    readonly run: () => Promise<unknown>;
    readonly resolve: (value: unknown) => void;
    readonly reject: (error: unknown) => void;
}

const jobs: Job[] = [];
let busy = false;

function pump(): void {
    if (busy || jobs.length === 0 || activity() === 'fullscreen') {
        return;
    }
    busy = true;
    const job = jobs.shift() as Job;
    const settle = (ok: boolean, value: unknown) => {
        busy = false;
        if (ok) {
            job.resolve(value);
        } else {
            job.reject(value);
        }
        pump();
    };
    let promise: Promise<unknown>;
    try {
        promise = job.run();
    } catch (error) {
        settle(false, error);
        return;
    }
    promise.then(
        (value) => settle(true, value),
        (error) => settle(false, error)
    );
}

/** Runs `run` when the requests queued before it have settled. */
export function serial<T>(run: () => Promise<T>, background = false): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const job: Job = { background, run, resolve: resolve as (value: unknown) => void, reject };
        let at = jobs.length;
        if (!background) {
            // Ahead of the background jobs, behind the viewer's own.
            while (at > 0 && jobs[at - 1].background) {
                at--;
            }
        }
        jobs.splice(at, 0, job);
        pump();
    });
}

/** For diagnostics: requests waiting, and whether one is out. */
export function requestQueueSize(): { waiting: number; busy: boolean } {
    return { waiting: jobs.length, busy };
}

onActivity(() => pump());
