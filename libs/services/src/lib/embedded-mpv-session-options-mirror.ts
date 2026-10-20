import {
    normalizePlaybackSmoothness,
    resolveEmbeddedMpvSessionExtraOptions,
    Settings,
} from '@iptvnator/shared/interfaces';

type EmbeddedMpvOptionsSettings = Pick<
    Settings,
    'embeddedMpvExtraOptions' | 'playbackSmoothness'
>;

/**
 * The extra options text the main process should hold for these settings:
 * the user's lines plus, in "Más estable", the stability options they did
 * not set. Main applies its mirror to every embedded MPV session it
 * creates, so writing the merged text from the renderer brings the
 * setting to installed apps without a new main process.
 */
export function embeddedMpvSessionOptionsFor(
    settings: EmbeddedMpvOptionsSettings
): string {
    return resolveEmbeddedMpvSessionExtraOptions(
        settings.embeddedMpvExtraOptions,
        normalizePlaybackSmoothness(settings.playbackSmoothness),
        typeof window === 'undefined' ? undefined : window.electron?.platform
    );
}

/**
 * Writes {@link embeddedMpvSessionOptionsFor} into the main-process mirror
 * (`SETTINGS_UPDATE`). Called once settings load, so the first session of
 * a run already has them. A no-op in the PWA; a failed write only leaves
 * the previous mirror in place.
 */
export async function mirrorEmbeddedMpvSessionOptions(
    settings: EmbeddedMpvOptionsSettings
): Promise<void> {
    const bridge = typeof window === 'undefined' ? undefined : window.electron;
    if (typeof bridge?.updateSettings !== 'function') {
        return;
    }
    try {
        await bridge.updateSettings({
            embeddedMpvExtraOptions: embeddedMpvSessionOptionsFor(settings),
        });
    } catch (error) {
        console.warn('Failed to mirror the embedded MPV options.', error);
    }
}
