/**
 * localStorage, which a TV can refuse (full, or blocked): every access is
 * guarded, and a missing value reads as the fallback.
 */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export class JsonStore {
    constructor(private readonly storage: StorageLike | null = defaultStorage()) {}

    read<T>(key: string, fallback: T): T {
        try {
            const raw = this.storage ? this.storage.getItem(key) : null;
            return raw === null ? fallback : (JSON.parse(raw) as T);
        } catch {
            return fallback;
        }
    }

    write(key: string, value: unknown): boolean {
        try {
            if (!this.storage) {
                return false;
            }
            this.storage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    remove(key: string): void {
        try {
            this.storage?.removeItem(key);
        } catch {
            // Nothing to remove from a storage that cannot be read.
        }
    }
}

/** An in-memory storage, for tests and for TVs that refuse localStorage. */
export class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        const value = this.values.get(key);
        return value === undefined ? null : value;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, String(value));
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }
}

export const store = new JsonStore();
