import { computed, type Signal, signal } from '@angular/core';
import type { PlayerController } from '../player-controls/player-controls.model';

const players = signal<readonly PlayerController[]>([]);

/**
 * The player on screen: the last controller that started (a web engine's
 * adapter on attach, Embedded MPV's once configured) and has not stopped.
 * Module state rather than a service because the web adapter is also built
 * with `new` outside an injection context; it holds signals only.
 */
export const activePlayerController = computed<PlayerController | null>(() => {
    const list = players();
    return list.length > 0 ? list[list.length - 1] : null;
});

/** Marks `controller` as playing until the returned function is called. */
export function registerActivePlayer(controller: PlayerController): () => void {
    players.update((list) => [
        ...list.filter((item) => item !== controller),
        controller,
    ]);
    let released = false;
    return () => {
        if (!released) {
            released = true;
            players.update((list) =>
                list.filter((item) => item !== controller)
            );
        }
    };
}

/** "Search OpenSubtitles…" as the player's subtitle menu offers it. */
export interface OnlineSubtitleSearch {
    readonly canSearch: Signal<boolean>;
    readonly searching: Signal<boolean>;
    search(): void;
}

/**
 * Set once a player host follows a playback (`OnlineSubtitlesCoordinator`);
 * the settings panel reads it without depending on the subtitle services.
 */
export const onlineSubtitleSearch = signal<OnlineSubtitleSearch | null>(null);
