import { inject, Injectable, signal } from '@angular/core';
import { XTREAM_DATA_SOURCE } from '@iptvnator/portal/xtream/data-access';
import type { PlatformTitle } from '../platforms/platform-titles';

type MyListKind = 'movie' | 'series';

/**
 * "Mi lista" on the Home's series cards: the source's favourites, the list
 * the "Mi lista" page shows. A favourite is kept against the title's row
 * in the stored catalog, so only a title the app has stored can be added
 * from here; for any other, `toggle` answers null and the caller opens the
 * title's page, whose own button can.
 */
@Injectable({ providedIn: 'root' })
export class HomeMyListService {
    private readonly dataSource = inject(XTREAM_DATA_SOURCE);
    private readonly saved = signal<ReadonlySet<string>>(new Set());
    private readonly checked = new Set<string>();

    isSaved(playlistId: string, title: PlatformTitle): boolean {
        return this.saved().has(listKey(playlistId, title));
    }

    /** Learns, once per title, whether it is on the list already. */
    async check(playlistId: string, titles: readonly PlatformTitle[]) {
        for (const title of titles) {
            const key = listKey(playlistId, title);
            if (this.checked.has(key)) {
                continue;
            }
            this.checked.add(key);
            const target = await this.target(playlistId, title);
            if (
                target &&
                (await this.dataSource.isFavorite(target, playlistId))
            ) {
                this.mark(key, true);
            }
        }
    }

    /**
     * Adds the title to the list, or takes it off: its new state, or null
     * when the title is not in the stored catalog (or the write failed).
     */
    async toggle(
        playlistId: string,
        title: PlatformTitle
    ): Promise<boolean | null> {
        try {
            const target = await this.target(playlistId, title);
            if (!target) {
                return null;
            }
            const key = listKey(playlistId, title);
            const saved = await this.dataSource.isFavorite(target, playlistId);
            if (saved) {
                await this.dataSource.removeFavorite(target, playlistId);
            } else {
                await this.dataSource.addFavorite(
                    target,
                    playlistId,
                    title.backdrop ?? undefined
                );
            }
            this.mark(key, !saved);
            return !saved;
        } catch {
            return null;
        }
    }

    private async target(playlistId: string, title: PlatformTitle) {
        const content = await this.dataSource
            .getContentByXtreamId(title.id, playlistId, title.kind)
            .catch(() => null);
        return content?.id != null
            ? { id: Number(content.id), type: title.kind as MyListKind }
            : null;
    }

    private mark(key: string, saved: boolean): void {
        this.saved.update((keys) => {
            const next = new Set(keys);
            if (saved) {
                next.add(key);
            } else {
                next.delete(key);
            }
            return next;
        });
    }
}

function listKey(playlistId: string, title: PlatformTitle): string {
    return `${playlistId}:${title.kind}:${title.id}`;
}
