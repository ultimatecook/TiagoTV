/** Times and dates as the TV shows them (24-hour clock, day/month/year). */
export function pad2(value: number): string {
    return value < 10 ? `0${value}` : String(value);
}

export function clockTime(date: Date): string {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function shortDate(date: Date): string {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "1:02:03" or "12:34", for the player. */
export function timecode(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    return hours > 0
        ? `${hours}:${pad2(minutes)}:${pad2(rest)}`
        : `${minutes}:${pad2(rest)}`;
}

/** "1 h 32 min", "47 min", for a title's length. */
export function durationLabel(seconds: number): string {
    const minutes = Math.round((seconds || 0) / 60);
    if (minutes <= 0) {
        return '';
    }
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours} h ${pad2(minutes % 60)} min` : `${minutes} min`;
}

/** Whether two dates fall on the same local day. */
export function sameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
