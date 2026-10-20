import { webImage } from './images';
import { audioLanguage, subtitleFields, subtitleSources, type SubtitleSource } from './media-info';

/**
 * A title's own page from the provider (`get_vod_info`,
 * `get_series_info`): synopsis, year, length, and a series' episodes by
 * season. Panels differ in field names and types; every field is optional.
 */
export interface TitleDetails {
    readonly plot: string | null;
    readonly year: number | null;
    readonly genre: string | null;
    readonly rating: number | null;
    readonly durationSeconds: number;
    readonly backdrop: string | null;
    readonly poster: string | null;
    readonly director: string | null;
    readonly cast: string | null;
}

/** What the provider says about a file's languages (media-info.ts). */
export interface FileLanguages {
    readonly subtitles: readonly SubtitleSource[];
    readonly audioLanguage: string | null;
}

export interface MovieDetails extends TitleDetails, FileLanguages {
    readonly extension: string | null;
}

export interface Episode extends FileLanguages {
    readonly id: number;
    readonly season: number;
    readonly number: number;
    readonly title: string;
    readonly extension: string;
    readonly durationSeconds: number;
    readonly plot: string | null;
    readonly image: string | null;
}

export interface SeriesDetails extends TitleDetails {
    readonly seasons: readonly number[];
    readonly episodes: ReadonlyMap<number, readonly Episode[]>;
}

type Raw = Record<string, unknown>;

const asObject = (value: unknown): Raw =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {};

function text(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
}

function number(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : null;
}

/** "01:32:10", "92 min", or seconds as a number. */
export function parseDuration(info: Raw): number {
    const seconds = number(info['duration_secs']);
    if (seconds && seconds > 0) {
        return seconds;
    }
    const raw = text(info['duration']) ?? '';
    const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
    if (clock) {
        return clock[3] !== undefined
            ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
            : Number(clock[1]) * 60 + Number(clock[2]);
    }
    const minutes = /(\d+)\s*min/i.exec(raw);
    return minutes ? Number(minutes[1]) * 60 : 0;
}

function year(info: Raw): number | null {
    for (const key of ['releasedate', 'releaseDate', 'release_date', 'year']) {
        const match = /((?:19|20)\d{2})/.exec(String(info[key] ?? ''));
        if (match) {
            return Number(match[1]);
        }
    }
    return null;
}

function firstImage(value: unknown): string | null {
    const list = Array.isArray(value) ? value : [value];
    for (const entry of list) {
        const url = webImage(entry);
        if (url) {
            return url;
        }
    }
    return null;
}

function titleDetails(info: Raw): TitleDetails {
    const rating = number(info['rating']);
    return {
        plot: text(info['plot']) ?? text(info['description']),
        year: year(info),
        genre: text(info['genre']),
        rating: rating !== null && rating > 0 && rating <= 10 ? rating : null,
        durationSeconds: parseDuration(info),
        backdrop: firstImage(info['backdrop_path']),
        poster: webImage(info['cover_big']) ?? webImage(info['movie_image']) ?? webImage(info['cover']),
        director: text(info['director']),
        cast: text(info['cast']) ?? text(info['actors']),
    };
}

export function parseVodInfo(raw: unknown): MovieDetails {
    const answer = asObject(raw);
    const data = asObject(answer['movie_data']);
    const info = asObject(answer['info']);
    return {
        ...titleDetails(info),
        extension: text(data['container_extension']),
        subtitles: subtitleSources(...subtitleFields(answer, info), ...subtitleFields(data, {})),
        audioLanguage: audioLanguage(info),
    };
}

function toEpisode(raw: unknown, fallbackSeason: number): Episode | null {
    const entry = asObject(raw);
    const id = number(entry['id']);
    if (id === null) {
        return null;
    }
    const info = asObject(entry['info']);
    const episodeNumber = number(entry['episode_num']) ?? 0;
    return {
        id,
        season: number(entry['season']) ?? fallbackSeason,
        number: episodeNumber,
        title: text(entry['title']) ?? `Episodio ${episodeNumber}`,
        extension: text(entry['container_extension']) ?? 'mp4',
        durationSeconds: parseDuration(info),
        plot: text(info['plot']),
        image: webImage(info['movie_image']),
        subtitles: subtitleSources(...subtitleFields(entry, info)),
        audioLanguage: audioLanguage(info),
    };
}

export function parseSeriesInfo(raw: unknown): SeriesDetails {
    const answer = asObject(raw);
    const rawEpisodes = answer['episodes'];
    const bySeason = new Map<number, Episode[]>();
    const add = (season: number, list: unknown) => {
        if (!Array.isArray(list)) {
            return;
        }
        for (const item of list) {
            const episode = toEpisode(item, season);
            if (episode) {
                const episodes = bySeason.get(episode.season) ?? [];
                episodes.push(episode);
                bySeason.set(episode.season, episodes);
            }
        }
    };
    if (Array.isArray(rawEpisodes)) {
        rawEpisodes.forEach((list, index) => add(index + 1, list));
    } else {
        const seasons = asObject(rawEpisodes);
        for (const key of Object.keys(seasons)) {
            add(Number(key) || 0, seasons[key]);
        }
    }
    bySeason.forEach((list) => list.sort((a, b) => a.number - b.number));
    const seasons: number[] = [];
    bySeason.forEach((_, season) => seasons.push(season));
    seasons.sort((a, b) => a - b);
    return {
        ...titleDetails(asObject(answer['info'])),
        seasons,
        episodes: bySeason,
    };
}
