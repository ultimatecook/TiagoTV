import { inject, Injectable, signal } from '@angular/core';
import { SettingsStore } from '@iptvnator/services';
import {
    ResolvedPortalPlayback,
    VideoPlayer,
    watchEmbeddedMpvSupport,
} from '@iptvnator/shared/interfaces';
import { resolveWebPlayerIsLive } from './web-player-playback-state';

/**
 * TiagoTV: movies and episodes play on Embedded MPV wherever this machine
 * has it. Provider VOD is mostly MKV with AC-3, E-AC-3 or DTS audio, which
 * the built-in web players cannot decode: the picture plays, silent. Live
 * channels keep the configured player (the one the mini-player docks).
 */
@Injectable({ providedIn: 'root' })
export class VodEmbeddedMpvAvailability {
    readonly available = signal(false);

    constructor() {
        const electron =
            typeof window === 'undefined' ? undefined : window.electron;
        if (!electron?.getEmbeddedMpvSupport) {
            return;
        }
        watchEmbeddedMpvSupport(
            () => electron.getEmbeddedMpvSupport(),
            (support) => this.available.set(support.supported),
            () => this.available.set(false)
        );
    }
}

/** The built-in web engines; external players and MPV stay as chosen. */
const WEB_ENGINES = new Set<VideoPlayer>([
    VideoPlayer.VideoJs,
    VideoPlayer.Html5Player,
    VideoPlayer.ArtPlayer,
]);

export function preferEmbeddedMpvForVod(
    configured: VideoPlayer,
    playback: ResolvedPortalPlayback | null,
    embeddedMpvAvailable: boolean
): VideoPlayer {
    if (
        !embeddedMpvAvailable ||
        !playback ||
        resolveWebPlayerIsLive(playback) ||
        !WEB_ENGINES.has(configured)
    ) {
        return configured;
    }
    return VideoPlayer.EmbeddedMpv;
}

/**
 * The player a web player view renders before recovery overrides: its own
 * override (the mini-player's), else the saved one with movies moved to
 * Embedded MPV. Call in an injection context.
 */
export function injectConfiguredWebPlayer(
    override: () => VideoPlayer | null,
    playback: () => ResolvedPortalPlayback | null
): () => VideoPlayer {
    const settings = inject(SettingsStore);
    const embeddedMpv = inject(VodEmbeddedMpvAvailability);
    return () =>
        override() ??
        preferEmbeddedMpvForVod(
            settings.player?.() ?? VideoPlayer.VideoJs,
            playback(),
            embeddedMpv.available()
        );
}
