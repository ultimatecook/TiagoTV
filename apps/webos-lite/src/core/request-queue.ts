import { activity, onActivity } from './activity';
import { RequestError } from './http';

/**
 * The provider's catalog requests, one at a time: the panel refuses
 * bursts, and its account allows a single connection. While the player
 * covers the screen, queued requests wait (a request already sent
 * finishes): the stream keeps the TV's network to itself. The player's
 * own calls (the account, the programme guide) go around the queue.
 *
 * Jobs run by priority, in order within one: what the viewer asked for
 * (0), then the sports board's refresh (1), then the Home's catalog
 * prefetch (2), so opening a title is never stuck behind forty catalog
 * categories and today's matches never wait for every series list.
 *
 * The queue cannot wedge: a job that has not settled `limitMs` after it
 * started (a request webOS suspended, an XHR that never reports) is given
 * up as a timeout and the next one runs; its late answer is ignored.
 */
export type Priority = 0 | 1 | 2;

export const VIEWER: Priority = 0;
export const SPORTS: Priority = 1;
export const PREFETCH: Priority = 2;

/** A job's limit when it names none. */
const DEFAULT_LIMIT_MS = 60000;

export interface JobOptions {
    readonly priority?: Priority;
    /** What runs, for Diagnóstico ("series · ES NETFLIX"), never a URL. */
    readonly label?: string;
    readonly limitMs?: number;
}

interface Job {
    readonly priority: Priority;
    readonly label: string;
    readonly limitMs: number;
    readonly run: () => Promise<unknown>;
    readonly resolve: (value: unknown) => void;
    readonly reject: (error: unknown) => void;
}

const jobs: Job[] = [];
let running: { job: Job; startedAt: number } | null = null;
let watchdogs = 0;

function pump(): void {
    if (running || jobs.length === 0 || activity() === 'fullscreen') {
        return;
    }
    const job = jobs.shift() as Job;
    const current = { job, startedAt: Date.now() };
    running = current;
    let done = false;
    let timer = 0;
    const settle = (ok: boolean, value: unknown) => {
        if (done) {
            return;
        }
        done = true;
        window.clearTimeout(timer);
        if (running === current) {
            running = null;
        }
        if (ok) {
            job.resolve(value);
        } else {
            job.reject(value);
        }
        pump();
    };
    timer = window.setTimeout(() => {
        watchdogs++;
        settle(false, new RequestError('timeout'));
    }, job.limitMs);
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

/** Runs `run` when the jobs before it (by priority) have settled. */
export function serial<T>(run: () => Promise<T>, options: JobOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const priority = options.priority ?? VIEWER;
        const job: Job = {
            priority,
            label: options.label ?? '',
            limitMs: options.limitMs ?? DEFAULT_LIMIT_MS,
            run,
            resolve: resolve as (value: unknown) => void,
            reject,
        };
        let at = jobs.length;
        while (at > 0 && jobs[at - 1].priority > priority) {
            at--;
        }
        jobs.splice(at, 0, job);
        pump();
    });
}

/** For tests and ares-inspect: requests waiting, and whether one is out. */
export function requestQueueSize(): { waiting: number; busy: boolean } {
    return { waiting: jobs.length, busy: running !== null };
}

export interface QueueState {
    readonly waiting: number;
    /** The running job's label and how long it has run (ms). */
    readonly running: { readonly label: string; readonly ageMs: number } | null;
    /** Jobs the watchdog gave up since the app started. */
    readonly watchdogs: number;
    readonly paused: boolean;
}

export function requestQueueState(now = Date.now()): QueueState {
    return {
        waiting: jobs.length,
        running: running ? { label: running.job.label, ageMs: now - running.startedAt } : null,
        watchdogs,
        paused: activity() === 'fullscreen' && jobs.length > 0,
    };
}

/** Starts the next job if one can run (the app came back to the front). */
export function kickRequestQueue(): void {
    pump();
}

onActivity(() => pump());
