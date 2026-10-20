import { computed, inject, type Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import { describePortalRequestError } from '@iptvnator/shared/interfaces';

/**
 * A failed details request in words ("No se pudo conectar con el servidor
 * (error 500)") for the detail page's error state. The store keeps the
 * request's own message for classification; it is never shown as is.
 * Call it in an injection context.
 */
export function injectXtreamDetailsErrorText(
    detailsError: Signal<string | null>
): Signal<string | undefined> {
    const translate = inject(TranslateService);
    const languageTick = injectTranslationTick();
    return computed(() => {
        languageTick();
        const error = detailsError();
        if (!error) {
            return undefined;
        }
        const { key, params } = describePortalRequestError(error);
        return translate.instant(key, params);
    });
}
