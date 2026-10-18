import type { SportSectionId } from './sport-sections';
import type { SportMatch } from './sports-catalog';

/**
 * Event channels keep "Live" in their name for a while after the final
 * whistle (on one feed while another already says "End"), and the panel's
 * list is only as fresh as its last load. So the clock decides: a match
 * is on from its kick-off, and over once it has run longer than its
 * competition's matches ever do, whatever its name says. Its kick-off is
 * the time a feed announced ("Next | … | 19:00 (GMT)"), remembered across
 * loads and restarts under every spelling of the match; for one only ever
 * seen live, the first time any feed was seen showing it.
 */
const HOUR = 3600_000;
const LONGEST: Partial<Record<SportSectionId, number>> = {
    tennis: 5 * HOUR,
    basketball: 3 * HOUR,
    motor: 3 * HOUR,
    // Cups go to extra time and penalties.
    'champions-league': 2.75 * HOUR,
    'europa-league': 2.75 * HOUR,
    libertadores: 2.75 * HOUR,
    'liga-argentina': 2.75 * HOUR,
    'rest-of-world': 2.75 * HOUR,
};
/**
 * A league match: 90 minutes, the break, stoppage time and a late
 * kick-off; none runs past it.
 */
const DEFAULT_LONGEST = 2.25 * HOUR;
/**
 * Each match key with its kick-off (ms). Keys of the earlier shape
 * ("title|competition") are no longer asked for and expire with KEEP.
 */
const STORAGE_KEY = 'tiagotv:kickoffs:v1';
/** Kick-offs older than this are forgotten. */
const KEEP = 2 * 24 * HOUR;

export function longestMatch(section: SportSectionId | null): number {
    return (section && LONGEST[section]) || DEFAULT_LONGEST;
}

/** Whether a match listed as live or upcoming is in fact over. */
export function isMatchOver(
    match: SportMatch,
    kickOff: Date | null,
    now: Date
): boolean {
    const start = match.event.start ?? kickOff;
    return (
        start !== null &&
        now.getTime() - start.getTime() > longestMatch(match.sectionId)
    );
}

/**
 * Whether a match that is not over is on now: a feed says "Live", or its
 * kick-off has passed while the feeds still say "Next".
 */
export function isMatchOn(
    match: SportMatch,
    kickOff: Date | null,
    now: Date
): boolean {
    const start = match.event.start ?? kickOff;
    return (
        !isMatchOver(match, kickOff, now) &&
        (match.event.status === 'live' ||
            (start !== null && start.getTime() <= now.getTime()))
    );
}

/** Kick-off times remembered across loads (and app restarts). */
export class KickoffMemory {
    private readonly times: Record<string, number>;

    constructor(
        private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
    ) {
        this.times = read(storage);
    }

    /**
     * Keeps the announced kick-offs, under each of a match's keys. A live
     * match none was known for started by now at the latest: that time
     * stands in for it, so a "Live" that outlasts its match still ends.
     */
    remember(matches: readonly SportMatch[], now = Date.now()): void {
        let changed = false;
        const set = (key: string, start: number) => {
            if (this.times[key] !== start) {
                this.times[key] = start;
                changed = true;
            }
        };
        for (const match of matches) {
            const announced = match.event.start?.getTime();
            const known = this.earliest(match.keys);
            const start =
                announced ??
                known ??
                (match.event.status === 'live' ? now : undefined);
            if (start !== undefined) {
                match.keys.forEach((key) => set(key, start));
            }
        }
        for (const [key, start] of Object.entries(this.times)) {
            if (now - start > KEEP) {
                delete this.times[key];
                changed = true;
            }
        }
        if (changed) {
            this.save();
        }
    }

    private save(): void {
        try {
            this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.times));
        } catch {
            // A full or blocked storage only costs the memory.
        }
    }

    /**
     * Fills in announced kick-offs (see announcedKickOffs) for matches
     * nothing is known of yet; what was seen keeps precedence.
     */
    fill(announced: ReadonlyMap<string, number>, now = Date.now()): void {
        let changed = false;
        announced.forEach((start, key) => {
            if (!(key in this.times) && now - start <= KEEP) {
                this.times[key] = start;
                changed = true;
            }
        });
        if (changed) {
            this.save();
        }
    }

    kickOffOf(match: SportMatch): Date | null {
        const start = this.earliest(match.keys);
        return start === undefined ? null : new Date(start);
    }

    private earliest(keys: readonly string[]): number | undefined {
        let earliest: number | undefined;
        for (const key of keys) {
            const start = this.times[key];
            if (
                typeof start === 'number' &&
                (earliest === undefined || start < earliest)
            ) {
                earliest = start;
            }
        }
        return earliest;
    }
}

function read(
    storage: Pick<Storage, 'getItem'> | null
): Record<string, number> {
    try {
        const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}
