import { isMatchOver, startOf } from './match-clock';
import { SPORT_SECTIONS } from './sport-sections';
import type { SportMatch, SportsCatalog } from './sports-catalog';

/**
 * TiagoTV sports by day: the hub's day picker (yesterday, today, tomorrow
 * and the two days after) and the matches kicking off on each local day.
 * The panel announces kick-offs ("Next | 2026-10-18 | 19:00 (GMT) | …")
 * hours ahead, rarely days, and lists no result: past and far days are
 * mostly empty.
 */
export interface MatchDay {
    /** Days from today: -1 yesterday, 0 today, 1 tomorrow… */
    readonly offset: number;
    readonly start: Date;
    readonly end: Date;
}

export const DAY_OFFSETS: readonly number[] = [-1, 0, 1, 2, 3];

export function matchDay(now: Date, offset: number): MatchDay {
    const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset
    );
    const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset + 1
    );
    end.setMilliseconds(-1);
    return { offset, start, end };
}

/**
 * The day's name: a translation key for yesterday, today and tomorrow,
 * else the short weekday and date ("Mié 22", "Wed 22").
 */
export interface DayName {
    /** Yesterday's, today's and tomorrow's translation key. */
    readonly key: string | null;
    /** The other days' "Mié 22". */
    readonly text: string;
}

export function dayName(offset: number, date: Date, locale?: string): DayName {
    const keys: Record<number, string> = {
        [-1]: 'WORKSPACE.SPORTS.DAYS.YESTERDAY',
        0: 'WORKSPACE.SPORTS.DAYS.TODAY',
        1: 'WORKSPACE.SPORTS.DAYS.TOMORROW',
    };
    return { key: keys[offset] ?? null, text: shortDate(date, locale) };
}

/** "Mié 22" (es), "Wed 22" (en). */
export function shortDate(date: Date, locale?: string): string {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
        .format(date)
        .replace(/\.$/, '');
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${date.getDate()}`;
}

/** "21:00" (es), "09:00 PM" (en). */
export function kickOffTime(date: Date, locale?: string): string {
    return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Days from `now`'s date to `date`'s (0 today, 1 tomorrow…). */
export function dayOffset(date: Date, now: Date): number {
    const day = (value: Date) =>
        new Date(value.getFullYear(), value.getMonth(), value.getDate());
    return Math.round((day(date).getTime() - day(now).getTime()) / 86_400_000);
}

/**
 * The matches kicking off on `day`, none over, by kick-off: the sections'
 * own, not "Resto del mundo"'s many (Burundi's league, Malawi's…), as on
 * the Home.
 */
export function matchesOnDay(
    catalog: SportsCatalog,
    day: MatchDay,
    now: Date,
    kickOffOf: (match: SportMatch) => Date | null = () => null
): SportMatch[] {
    const found: { match: SportMatch; at: number }[] = [];
    for (const section of SPORT_SECTIONS) {
        if (section.catchAll) {
            continue;
        }
        for (const match of catalog[section.id]?.matches ?? []) {
            const kickOff = startOf(match, kickOffOf(match));
            if (
                kickOff !== null &&
                kickOff >= day.start &&
                kickOff <= day.end &&
                !isMatchOver(match, kickOff, now)
            ) {
                found.push({ match, at: kickOff.getTime() });
            }
        }
    }
    return found.sort((a, b) => a.at - b.at).map(({ match }) => match);
}
