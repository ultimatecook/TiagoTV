import {
    genreLabelKey,
    type PlatformGenre,
    type PlatformTitle,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { durationLabel } from '../core/format';
import { t, type StringKey } from './strings';
import type { ResumeEntry } from './resume';

/**
 * The meta lines the desktop writes under and over titles: "2022 ·
 * Comedia · ★ 7.6" under a poster, "Película · 2023" in a hero,
 * "T2·E5 · Quedan 23 min" for what was left half-watched.
 */
export function genreLabel(genre: PlatformGenre): string {
    return t(genreLabelKey(genre) as StringKey);
}

export function posterMeta(title: PlatformTitle): string {
    const parts: string[] = [];
    if (title.year) {
        parts.push(String(title.year));
    }
    if (title.genres[0]) {
        parts.push(genreLabel(title.genres[0]));
    }
    if (title.rating) {
        parts.push(`★ ${title.rating.toFixed(1)}`);
    }
    return parts.join(' · ');
}

export function kindLabel(kind: 'movie' | 'series'): string {
    return t(kind === 'movie' ? 'WORKSPACE.DASHBOARD.TYPE_MOVIE' : 'WORKSPACE.DASHBOARD.TYPE_SERIES');
}

/** "Película · 2023 · Drama". */
export function heroMeta(title: PlatformTitle): string {
    const parts = [kindLabel(title.kind)];
    if (title.year) {
        parts.push(String(title.year));
    }
    if (title.genres[0]) {
        parts.push(genreLabel(title.genres[0]));
    }
    return parts.join(' · ');
}

/** "Quedan 23 min", "Quedan 1 h 05 min". */
export function remainingLabel(entry: ResumeEntry): string {
    const left = Math.max(0, Math.round((entry.duration - entry.position) / 60));
    if (left <= 0 || entry.duration <= 0) {
        return '';
    }
    const hours = Math.floor(left / 60);
    return hours > 0
        ? t('WORKSPACE.DASHBOARD.REMAINING_HOURS_MINUTES', { hours, minutes: left % 60 })
        : t('WORKSPACE.DASHBOARD.REMAINING_MINUTES', { minutes: left });
}

/** "T2·E5 · Quedan 23 min" or "Película · Quedan 38 min". */
export function resumeMeta(entry: ResumeEntry): string {
    const where =
        entry.kind === 'episode'
            ? t('WORKSPACE.DASHBOARD.SEASON_EPISODE_BADGE', { season: entry.season ?? 1, episode: entry.episode ?? 1 })
            : kindLabel('movie');
    const left = remainingLabel(entry);
    return left ? `${where} · ${left}` : where;
}

/** "1 h 32 min" with the desktop's words. */
export function runningTime(seconds: number): string {
    return durationLabel(seconds);
}
