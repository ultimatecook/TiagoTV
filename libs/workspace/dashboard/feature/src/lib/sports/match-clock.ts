import type { SportSectionId } from './sport-sections';
import type { SportMatch } from './sports-catalog';

/**
 * Event channels keep "Live" in their name for a while after the final
 * whistle, and the panel's list is only as fresh as its last load. A match
 * seen earlier as "Next" left its kick-off behind: once a match has run
 * longer than its sport ever does, it is over, whatever its name says.
 */
const HOUR = 3600_000;
const LONGEST: Partial<Record<SportSectionId, number>> = {
    tennis: 5 * HOUR,
    basketball: 3 * HOUR,
    motor: 3 * HOUR,
};
/** Football and anything else: 90 minutes, the break, stoppage, extra time. */
const DEFAULT_LONGEST = 2.5 * HOUR;
const STORAGE_KEY = 'tiagotv:kickoffs:v1';
/** Kick-offs older than this are forgotten. */
const KEEP = 2 * 24 * HOUR;

export function longestMatch(section: SportSectionId | null): number {
    return (section && LONGEST[section]) || DEFAULT_LONGEST;
}

export function matchKey(match: SportMatch): string {
    return `${match.event.title}|${match.event.competition}`.toLowerCase();
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

/** Kick-off times remembered across loads (and app restarts). */
export class KickoffMemory {
    private readonly times: Record<string, number>;

    constructor(
        private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null
    ) {
        this.times = read(storage);
    }

    /**
     * Keeps the kick-offs of upcoming matches. A live match first seen
     * without one started by now at the latest: that time stands in for
     * it, so a "Live" that outlasts its match still ends.
     */
    remember(matches: readonly SportMatch[], now = Date.now()): void {
        let changed = false;
        for (const match of matches) {
            const key = matchKey(match);
            const start =
                match.event.start?.getTime() ??
                (match.event.status === 'live' && !(key in this.times)
                    ? now
                    : undefined);
            if (start !== undefined && this.times[key] !== start) {
                this.times[key] = start;
                changed = true;
            }
        }
        for (const [key, start] of Object.entries(this.times)) {
            if (now - start > KEEP) {
                delete this.times[key];
                changed = true;
            }
        }
        if (changed) {
            try {
                this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.times));
            } catch {
                // A full or blocked storage only costs the memory.
            }
        }
    }

    kickOffOf(match: SportMatch): Date | null {
        const start = this.times[matchKey(match)];
        return start === undefined ? null : new Date(start);
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
