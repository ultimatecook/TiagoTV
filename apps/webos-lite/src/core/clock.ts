/**
 * The TV's clock against the provider's (`server_info.timestamp_now` of
 * the account answer). Matches are "on" by the clock (match-clock), so a
 * TV set hours off shows no live match: Diagnóstico says so.
 */
let offsetMs: number | null = null;

/** The server's time (epoch seconds) as of now. */
export function noteServerTime(seconds: unknown): void {
    const value = Number(seconds);
    if (Number.isFinite(value) && value > 1e9) {
        offsetMs = value * 1000 - Date.now();
    }
}

/** Server minus TV, in ms; null until the account was asked. */
export function serverOffset(): number | null {
    return offsetMs;
}
