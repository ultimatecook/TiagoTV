import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { injectTranslationTick } from '@iptvnator/services';
import type { MatchFeed } from '../match-feeds';

/** The bundled flags (flag-icons', see assets/flags/LICENSE). */
const FLAGS = './assets/flags/';

/**
 * A feed's language as the app's language names it ("Inglés (UK)",
 * "English (UK)"), its Spanish label for a code the app does not know.
 * Reads the translations' tick: current inside a `computed`.
 */
export function injectFeedLanguage(): (
    feed: MatchFeed | null | undefined
) => string {
    const translate = inject(TranslateService);
    const tick = injectTranslationTick();
    return (feed) => {
        tick();
        if (!feed) {
            return '';
        }
        const key = `WORKSPACE.SPORTS.FEED_LANGUAGES.${feed.language}`;
        const text: unknown = translate.instant(key);
        return typeof text === 'string' && text && text !== key
            ? text
            : feed.label;
    };
}

/** A feed's flag, where one is bundled. */
export function feedFlag(feed: MatchFeed): string | null {
    return feed.flag ? `${FLAGS}${feed.flag}.svg` : null;
}
