import { computed, inject, type Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import type { SportMatch } from './sports-catalog';

/**
 * Both sides of a match, as the sports views show them; a race has none,
 * however its feed names it ("Nascar GP Belgium - Nascar Pro Race 2").
 */
export function matchSides(
    match: SportMatch
): { readonly home: string; readonly away: string } | null {
    const { home, away } = match.event;
    return home && away && match.sectionId !== 'motor' ? { home, away } : null;
}

/** The app's language for dates and times ("21:00", "Mié 22"), kept current. */
export function injectSportsLocale(): Signal<string | undefined> {
    const translate = inject(TranslateService);
    const tick = injectTranslationTick();
    return computed(() => {
        tick();
        return translate.currentLang || translate.defaultLang || undefined;
    });
}
