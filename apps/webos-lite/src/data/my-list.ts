import { store, type JsonStore } from '../core/storage';

/**
 * "Mi lista": the titles and channels the viewer kept, on this TV only
 * (localStorage, `tiagotv.lite.milista`), newest first. Small entries: a
 * title's ids, name and poster, a channel's id, name and logo.
 */
export type ListKind = 'movie' | 'series' | 'live';

export interface ListEntry {
    readonly kind: ListKind;
    readonly id: number;
    readonly title: string;
    readonly image: string | null;
    /** A title's category (its platform), for its page. */
    readonly categoryId?: string;
    readonly addedAt: number;
}

const KEY = 'tiagotv.lite.milista';
const MAX = 200;

export class MyList {
    constructor(private readonly from: JsonStore = store) {}

    all(): ListEntry[] {
        const value = this.from.read<ListEntry[]>(KEY, []);
        return Array.isArray(value) ? value.filter((entry) => entry && typeof entry.id === 'number') : [];
    }

    has(kind: ListKind, id: number): boolean {
        return this.all().some((entry) => entry.kind === kind && entry.id === id);
    }

    /** Adds the entry, or removes it if it was there; true when added. */
    toggle(entry: Omit<ListEntry, 'addedAt'>, now = Date.now()): boolean {
        const entries = this.all();
        const index = entries.findIndex((item) => item.kind === entry.kind && item.id === entry.id);
        if (index >= 0) {
            entries.splice(index, 1);
            this.from.write(KEY, entries);
            return false;
        }
        entries.unshift({ ...entry, addedAt: now });
        this.from.write(KEY, entries.slice(0, MAX));
        return true;
    }
}

export const myList = new MyList();
