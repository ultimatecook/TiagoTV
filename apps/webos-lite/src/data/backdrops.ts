import type { PlatformTitle } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import type { XtreamClient } from '../xtream/client';
import { parseSeriesInfo, parseVodInfo } from './details';

/**
 * Backdrops for the heroes: a list gives series theirs and movies none, so
 * a hero's few titles without one ask their own page (as the desktop does),
 * one at a time in the background, and keep the answer for the session.
 */
export class Backdrops {
    private readonly found = new Map<string, string | null>();

    constructor(
        private readonly client: XtreamClient,
        private readonly onFound: () => void
    ) {}

    of(title: PlatformTitle): string | null {
        return title.backdrop ?? this.found.get(`${title.kind}:${title.id}`) ?? null;
    }

    async probe(titles: readonly PlatformTitle[], limit: number): Promise<void> {
        const wanted = titles
            .filter((title) => !title.backdrop && !this.found.has(`${title.kind}:${title.id}`))
            .slice(0, limit);
        // All marked first: a second hero asking meanwhile does not repeat them.
        wanted.forEach((title) => this.found.set(`${title.kind}:${title.id}`, null));
        for (const title of wanted) {
            const key = `${title.kind}:${title.id}`;
            try {
                const info =
                    title.kind === 'movie'
                        ? parseVodInfo(await this.client.vodInfo(title.id, true))
                        : parseSeriesInfo(await this.client.seriesInfo(title.id, true));
                if (info.backdrop) {
                    this.found.set(key, info.backdrop);
                    this.onFound();
                }
            } catch {
                // No page: the hero shows the poster.
            }
        }
    }
}
