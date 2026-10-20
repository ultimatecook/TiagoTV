import { inject, type Provider } from '@angular/core';
import { SettingsStore } from '@iptvnator/services';
import { normalizePlaybackSmoothness } from '@iptvnator/shared/interfaces';
import { PLAYBACK_SMOOTHNESS } from '../web-video-support/playback-smoothness';

/**
 * The user's "Fluidez" for the web engines of one player view, read when
 * an engine starts a stream: a change applies to the next stream, never
 * to one already playing.
 */
export const WEB_PLAYER_PLAYBACK_SMOOTHNESS: Provider = {
    provide: PLAYBACK_SMOOTHNESS,
    useFactory: () => {
        const settings = inject(SettingsStore);
        return () =>
            normalizePlaybackSmoothness(settings.playbackSmoothness?.());
    },
};
