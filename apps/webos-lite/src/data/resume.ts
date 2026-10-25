import { store, type JsonStore } from '../core/storage';

/**
 * Where each movie and episode was left, in the TV's localStorage, so the
 * title's page offers "Continuar" and the tabs a "Seguir viendo" row.
 */
export type ResumeKind = 'movie' | 'episode';

export interface ResumeEntry {
    readonly kind: ResumeKind;
    readonly id: number;
    readonly extension: string;
    readonly title: string;
    readonly poster: string | null;
    /** Seconds. */
    readonly position: number;
    readonly duration: number;
    readonly updatedAt: number;
    readonly seriesId?: number;
    readonly seriesTitle?: string;
    readonly season?: number;
    readonly episode?: number;
}

const KEY = 'tiagotv-lite:resume:v1';
/** Starting a title is not watching it; nearly finishing it is finishing it. */
export const MIN_POSITION = 30;
export const DONE_SHARE = 0.95;
const MAX_ENTRIES = 120;

const keyOf = (kind: ResumeKind, id: number) => `${kind}:${id}`;

export class ResumeStore {
    constructor(private readonly from: JsonStore = store) {}

    private all(): Record<string, ResumeEntry> {
        const value = this.from.read<Record<string, ResumeEntry>>(KEY, {});
        return value && typeof value === 'object' ? value : {};
    }

    get(kind: ResumeKind, id: number): ResumeEntry | null {
        return this.all()[keyOf(kind, id)] ?? null;
    }

    /** The position to start at, or 0. */
    positionOf(kind: ResumeKind, id: number): number {
        const entry = this.get(kind, id);
        return entry ? entry.position : 0;
    }

    /** Saves a position; one too early or past the end clears the entry. */
    save(entry: Omit<ResumeEntry, 'updatedAt'>, now = Date.now()): void {
        const entries = this.all();
        const key = keyOf(entry.kind, entry.id);
        const finished =
            entry.duration > 0 && entry.position >= entry.duration * DONE_SHARE;
        if (finished || entry.position < MIN_POSITION) {
            if (finished || entries[key]) {
                delete entries[key];
                this.from.write(KEY, entries);
            }
            return;
        }
        entries[key] = { ...entry, updatedAt: now };
        const keys = Object.keys(entries).sort(
            (a, b) => entries[b].updatedAt - entries[a].updatedAt
        );
        for (const old of keys.slice(MAX_ENTRIES)) {
            delete entries[old];
        }
        this.from.write(KEY, entries);
    }

    remove(kind: ResumeKind, id: number): void {
        const entries = this.all();
        delete entries[keyOf(kind, id)];
        this.from.write(KEY, entries);
    }

    clear(): void {
        this.from.remove(KEY);
    }

    /**
     * What the viewer left half-watched, latest first: movies, or for
     * series the last episode of each show.
     */
    recent(kind: ResumeKind, limit = 20): ResumeEntry[] {
        const entries = this.all();
        const list = Object.keys(entries)
            .map((key) => entries[key])
            .filter((entry) => entry && entry.kind === kind)
            .sort((a, b) => b.updatedAt - a.updatedAt);
        if (kind === 'movie') {
            return list.slice(0, limit);
        }
        const shows = new Set<number>();
        return list
            .filter((entry) => {
                const show = entry.seriesId ?? entry.id;
                if (shows.has(show)) {
                    return false;
                }
                shows.add(show);
                return true;
            })
            .slice(0, limit);
    }
}

export const resume = new ResumeStore();
