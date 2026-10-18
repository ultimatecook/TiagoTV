import {
    EnvironmentInjector,
    inject,
    provideAppInitializer,
} from '@angular/core';

/**
 * TiagoTV: a streaming platform dresses its own page and the movie and
 * series pages of its catalog, so a Netflix title opens like Netflix
 * (`PlatformThemeService` in the dashboard feature). The feature is
 * lazy-loaded, so the service follows the router once its chunk arrives,
 * off the startup path.
 */
export function providePlatformTheme() {
    return provideAppInitializer(() => {
        const injector = inject(EnvironmentInjector);
        void import('@iptvnator/workspace/dashboard/feature')
            .then(({ PlatformThemeService }) =>
                injector.get(PlatformThemeService).start()
            )
            .catch(() => undefined);
    });
}
