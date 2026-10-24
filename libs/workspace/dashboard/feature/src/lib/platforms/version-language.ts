import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import { SettingsStore } from '@iptvnator/services';
import { normalizeAudioLanguage } from '@iptvnator/shared/interfaces';
import type { PlatformLanguage } from './streaming-platforms';

/**
 * The version of a show the catalog shows and opens (see
 * `mergePlatformTitles`): the English one, its original language where the
 * provider files one, unless Settings → Playback → Audio language asks for
 * the Spanish dub. A show filed in one language shows in that one either
 * way.
 */
export function preferredVersionLanguage(
    audioLanguage: unknown
): PlatformLanguage {
    return normalizeAudioLanguage(audioLanguage) === 'es' ? 'ES' : 'EN';
}

/** The preferred version language, following the setting. */
export const PREFERRED_VERSION_LANGUAGE = new InjectionToken<
    Signal<PlatformLanguage>
>('PREFERRED_VERSION_LANGUAGE', {
    providedIn: 'root',
    factory: () => {
        const settings = inject(SettingsStore);
        return computed(() =>
            preferredVersionLanguage(settings.audioLanguage?.())
        );
    },
});
