/**
 * The day's draw for a platform page: what it recommends and how its rows
 * mix their titles change from one day to the next, and hold still for a
 * visit (the page takes the seed once).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The local day's number: the same seed all day long. */
export function daySeed(now: Date = new Date()): number {
    return Math.floor(
        (now.getTime() - now.getTimezoneOffset() * 60 * 1000) / DAY_MS
    );
}

/** A fixed number in [0, 1) for a key and a seed (FNV-1a, mixed). */
export function seededUnit(seed: number, key: string): number {
    let hash = (2166136261 ^ seed) >>> 0;
    for (let i = 0; i < key.length; i++) {
        hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    }
    hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
    hash ^= hash >>> 12;
    return (hash >>> 0) / 4294967296;
}
