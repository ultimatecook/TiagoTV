import { titleExtras } from '../platforms/platform-hero';

/**
 * What a title's own page (get_vod_info / get_series_info) adds to the
 * catalog's hero: the backdrop a movie list lacks, the year, the genres
 * as the provider writes them, and the running time or the seasons.
 */
export interface CatalogExtras {
    readonly plot: string | null;
    readonly backdrop: string | null;
    readonly genres: readonly string[];
    readonly year: number | null;
    /** A movie's running time, in minutes. */
    readonly minutes: number | null;
    /** A series' seasons with episodes. */
    readonly seasons: number | null;
}

interface InfoAnswer {
    readonly info?: Record<string, unknown> | null;
    readonly episodes?: Record<string, readonly unknown[]> | null;
    readonly seasons?: readonly { readonly season_number?: unknown }[] | null;
}

const YEAR = /((?:19|20)\d{2})/;

export function catalogExtras(answer: unknown): CatalogExtras {
    const data: InfoAnswer =
        answer && typeof answer === 'object' && !Array.isArray(answer)
            ? (answer as InfoAnswer)
            : {};
    const info = data.info && typeof data.info === 'object' ? data.info : {};
    const base = titleExtras(info);
    return {
        ...base,
        year: readYear(info),
        minutes: readMinutes(info),
        seasons: readSeasons(data),
    };
}

function readYear(info: Record<string, unknown>): number | null {
    for (const key of ['releasedate', 'releaseDate', 'release_date', 'year']) {
        const match = YEAR.exec(String(info[key] ?? ''));
        if (match) {
            return Number(match[1]);
        }
    }
    return null;
}

/** "01:52:00", 6720 seconds, or "112" minutes a run. */
function readMinutes(info: Record<string, unknown>): number | null {
    const seconds = Number(info['duration_secs']);
    if (Number.isFinite(seconds) && seconds > 0) {
        return Math.round(seconds / 60);
    }
    const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(
        String(info['duration'] ?? '').trim()
    );
    if (clock) {
        const minutes = Number(clock[1]) * 60 + Number(clock[2]);
        return minutes > 0 ? minutes : null;
    }
    const run = parseInt(String(info['episode_run_time'] ?? ''), 10);
    return Number.isFinite(run) && run > 0 ? run : null;
}

function readSeasons(data: InfoAnswer): number | null {
    const episodes = data.episodes;
    if (episodes && typeof episodes === 'object') {
        const count = Object.keys(episodes).filter(
            (season) =>
                Array.isArray(episodes[season]) && episodes[season].length > 0
        ).length;
        if (count > 0) {
            return count;
        }
    }
    const seasons = Array.isArray(data.seasons)
        ? data.seasons.filter((season) => Number(season?.season_number) > 0)
        : [];
    return seasons.length > 0 ? seasons.length : null;
}

/** "1 h 52 min" / "48 min": the parts the template translates. */
export function runningTime(
    minutes: number
): { readonly hours: number; readonly minutes: string } | number {
    if (minutes < 60) {
        return minutes;
    }
    return {
        hours: Math.floor(minutes / 60),
        minutes: String(minutes % 60).padStart(2, '0'),
    };
}
