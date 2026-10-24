import type { SubtitleLookup, TitlePlatformRef } from '@iptvnator/services';
import type { ResolvedPortalPlayback } from '@iptvnator/shared/interfaces';

/** One movie or episode of one source: what a search is done once for. */
export function playbackContentKey(
    playback: ResolvedPortalPlayback | null
): string | null {
    const info = playback?.contentInfo;
    return info && playback?.isLive !== true
        ? `${info.playlistId}:${info.contentType}:${info.contentXtreamId}`
        : null;
}

/**
 * What OpenSubtitles is asked for a playing movie or episode: the title
 * page's name, year and ids when the page shows this very title (an
 * alternative source's playback has the movie's name only), the season and
 * episode from the playback. Null for live TV, and for an episode whose
 * series the page does not name.
 */
export function subtitleLookupFor(
    playback: ResolvedPortalPlayback | null,
    title: TitlePlatformRef | null
): SubtitleLookup | null {
    const info = playback?.contentInfo;
    if (!playback || !info || playback.isLive === true) {
        return null;
    }
    const episode = info.contentType === 'episode';
    const sameTitle =
        !!title &&
        title.playlistId === info.playlistId &&
        title.kind === (episode ? 'series' : 'movie') &&
        Number(title.itemId) ===
            (episode ? info.seriesXtreamId : info.contentXtreamId);
    const page = sameTitle ? (title?.lookup ?? null) : null;
    if (episode) {
        return page && (page.name || page.tmdbId)
            ? {
                  kind: 'episode',
                  title: page.name,
                  year: page.year ?? null,
                  tmdbId: page.tmdbId ?? null,
                  imdbId: page.imdbId ?? null,
                  season: info.seasonNumber ?? null,
                  episode: info.episodeNumber ?? null,
              }
            : null;
    }
    const name = page?.name || playback.title;
    return name
        ? {
              kind: 'movie',
              title: name,
              year: page?.year ?? null,
              tmdbId: page?.tmdbId ?? null,
              imdbId: page?.imdbId ?? null,
          }
        : null;
}
