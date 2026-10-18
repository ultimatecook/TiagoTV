/**
 * TiagoTV sports: the provider's event channels rename themselves after
 * the match they carry, in a fixed shape:
 *
 *   Live | Leeds United - Manchester United | Premier League | ES
 *   Next | 2026-10-18 | 15:30 (GMT) | Nottingham Forest - Arsenal | Premier League | ES
 *   End | Udinese - Lecce | Serie A | ES
 *   ES | No Event
 *
 * Status first, the kick-off (GMT) for upcoming ones, then the title, the
 * competition and the feed's country. Extra segments ("El Post | Jornada 9")
 * belong to the title.
 */
export type SportEventStatus = 'live' | 'next' | 'end';

export interface SportEvent {
    readonly status: SportEventStatus;
    /** "Leeds United - Manchester United", "6 horas de Barcelona". */
    readonly title: string;
    readonly home: string | null;
    readonly away: string | null;
    readonly competition: string;
    /** Kick-off, known for upcoming events only. */
    readonly start: Date | null;
    /** The feed's country code (ES, GB…), when given. */
    readonly country: string | null;
}

const STATUS: Record<string, SportEventStatus> = {
    live: 'live',
    next: 'next',
    end: 'end',
};

const KICK_OFF_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KICK_OFF_TIME = /^(\d{1,2}):(\d{2})\s*\(GMT\)$/i;
const COUNTRY = /^[A-Z]{2}$/;
/** "A - B", "A vs B", "A vs. B", "A v B". */
const TEAMS = /^(.+?)\s+(?:-|vs\.?|v)\s+(.+)$/i;

export function parseSportEvent(name: string): SportEvent | null {
    const parts = name.split('|').map((part) => part.trim());
    const status = STATUS[parts[0]?.toLowerCase() ?? ''];
    if (!status) {
        return null;
    }
    let rest = parts.slice(1).filter(Boolean);

    let start: Date | null = null;
    if (status === 'next' && KICK_OFF_DATE.test(rest[0] ?? '')) {
        const time = KICK_OFF_TIME.exec(rest[1] ?? '');
        start = new Date(
            `${rest[0]}T${time ? `${time[1].padStart(2, '0')}:${time[2]}` : '00:00'}:00Z`
        );
        rest = rest.slice(time ? 2 : 1);
    }

    const country = COUNTRY.test(rest[rest.length - 1] ?? '')
        ? (rest.pop() ?? null)
        : null;
    if (rest.length < 2) {
        return null;
    }
    const competition = rest.pop() as string;
    const title = rest.join(' · ');
    const teams = rest.length === 1 ? TEAMS.exec(rest[0]) : null;

    return {
        status,
        title,
        home: teams?.[1].trim() ?? null,
        away: teams?.[2].trim() ?? null,
        competition,
        start,
        country,
    };
}

/** "ES | No Event", "GB | No Event": an event slot waiting for its match. */
export function isIdleEventChannel(name: string): boolean {
    return /\|\s*no event\s*$/i.test(name.trim());
}
