import type { CatalogTitle, PlatformTitle } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { resume } from '../data/resume';
import type { App } from '../app';

/**
 * A hero's "Reproducir": a movie plays at once (from where it was left);
 * a series opens its page and starts its first episode once it is known.
 */
export function playTitle(app: App, title: PlatformTitle | CatalogTitle): void {
    if (title.kind === 'series') {
        app.openTitle(title, { autoplay: true });
        return;
    }
    const version = title.versions[0] ?? title;
    app.play({
        items: [
            {
                kind: 'movie',
                id: version.id,
                title: version.title,
                extension: app.store.extensions.get(version.id) ?? 'mp4',
                poster: title.poster,
            },
        ],
        index: 0,
        startAt: resume.positionOf('movie', version.id),
    });
}
