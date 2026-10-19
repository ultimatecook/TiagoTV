import { epgDisplayTimeMs, type EpgItem } from '@iptvnator/shared/interfaces';

/**
 * What the playing channel shows now and next, from the guide the live
 * view loads for a channel. Programme times are the provider's raw clock;
 * `providerNowMs` is the wall clock in it (`epgProviderClockMs`), and the
 * times shown are moved by the display offset (`epgDisplayTimeMs`).
 */
export interface TvProgramme {
    readonly title: string;
    /** "20:00 – 21:00" (now) or "21:00" (next), in display time. */
    readonly time: string;
    /** 0–100 for the programme on now; null for the next one. */
    readonly progress: number | null;
}

export interface TvNowNext {
    readonly now: TvProgramme | null;
    readonly next: TvProgramme | null;
}

export function nowAndNext(
    items: readonly EpgItem[],
    providerNowMs: number,
    offsetMinutes: number
): TvNowNext | null {
    const timed = items
        .map((item) => ({
            title: item.title?.trim() ?? '',
            start: timeMs(item.start_timestamp, item.start),
            stop: timeMs(item.stop_timestamp, item.stop ?? item.end),
        }))
        .filter(
            (item): item is { title: string; start: number; stop: number } =>
                !!item.title &&
                item.start !== null &&
                item.stop !== null &&
                item.stop > item.start
        )
        .sort((a, b) => a.start - b.start);
    const now = timed.find(
        (item) => item.start <= providerNowMs && providerNowMs < item.stop
    );
    const next = timed.find(
        (item) => item.start >= (now?.stop ?? providerNowMs)
    );
    if (!now && !next) {
        return null;
    }
    const clock = (ms: number) =>
        formatTime(epgDisplayTimeMs(ms, offsetMinutes));
    return {
        now: now
            ? {
                  title: now.title,
                  time: `${clock(now.start)} – ${clock(now.stop)}`,
                  progress: Math.round(
                      ((providerNowMs - now.start) / (now.stop - now.start)) *
                          100
                  ),
              }
            : null,
        next: next
            ? { title: next.title, time: clock(next.start), progress: null }
            : null,
    };
}

/** Unix seconds when given, else the date string. */
function timeMs(
    seconds: string | number | null | undefined,
    text: string | null | undefined
): number | null {
    const fromSeconds = Number(seconds);
    if (Number.isFinite(fromSeconds) && fromSeconds > 0) {
        return fromSeconds * 1000;
    }
    const parsed = text ? Date.parse(text.replace(' ', 'T')) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

function formatTime(ms: number): string {
    const date = new Date(ms);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
