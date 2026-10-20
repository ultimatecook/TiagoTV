import type { PlatformTitle, PlatformTitleVersion } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { Episode, SeriesDetails, TitleDetails } from '../data/details';
import { resume } from '../data/resume';
import type { App, PlayItem } from '../app';

/**
 * What the title page plays: the movie (from where it was left, or from
 * the start), an episode with the season's others to follow, the first
 * episode ("Empezar T1 · E1"), or the episode left half-watched.
 */
export class DetailPlayback {
    constructor(
        private readonly app: App,
        private readonly title: PlatformTitle,
        private readonly version: () => PlatformTitleVersion,
        private readonly details: () => TitleDetails | null
    ) {}

    playMovie(startAt: number): void {
        const version = this.version();
        const details = this.details() as { extension?: string | null; durationSeconds?: number } | null;
        const extension = this.app.store.extensions.get(version.id) ?? details?.extension ?? 'mp4';
        this.app.play({
            items: [
                {
                    kind: 'movie',
                    id: version.id,
                    title: version.title,
                    extension,
                    poster: this.title.poster,
                    duration: details?.durationSeconds,
                },
            ],
            index: 0,
            startAt,
        });
    }

    private items(episodes: readonly Episode[]): PlayItem[] {
        const version = this.version();
        return episodes.map((episode) => ({
            kind: 'episode',
            id: episode.id,
            title: episode.title,
            subtitle: `${version.title} · T${episode.season}:E${episode.number}`,
            extension: episode.extension,
            poster: this.title.poster,
            seriesId: version.id,
            seriesTitle: version.title,
            season: episode.season,
            episode: episode.number,
            duration: episode.durationSeconds,
        }));
    }

    /** Plays `episodes[index]`; Back returns to the episode it ended on. */
    playEpisode(episodes: readonly Episode[], index: number, list: HTMLElement | null, fromStart = false): void {
        const items = this.items(episodes);
        const item = items[index];
        if (!item) {
            return;
        }
        this.app.play({
            items,
            index,
            startAt: fromStart ? 0 : resume.positionOf('episode', item.id),
            onIndexChange: (next) => {
                const row = list ? (list.children[next] as HTMLElement | undefined) : undefined;
                this.app.stack.setReturnFocus(row ?? null);
            },
        });
    }

    playFirst(series: SeriesDetails, showSeason: (season: number) => void): void {
        const season = series.seasons[0];
        showSeason(season);
        this.playEpisode(series.episodes.get(season) ?? [], 0, null, true);
    }

    resumeEpisode(series: SeriesDetails | null, episodeId: number, showSeason: (season: number) => void): void {
        if (!series) {
            return;
        }
        for (const season of series.seasons) {
            const episodes = series.episodes.get(season) ?? [];
            const index = episodes.findIndex((episode) => episode.id === episodeId);
            if (index >= 0) {
                showSeason(season);
                this.playEpisode(episodes, index, null);
                return;
            }
        }
    }
}
