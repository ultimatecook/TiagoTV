import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { documentLocale, formatRating } from './rating-format.util';

/**
 * `{{ 7.2 | appRating }}` reads "7,2" in Spanish. Impure so a language
 * switch reaches ratings already on screen; the last answer is reused
 * until the value or the language changes.
 */
@Pipe({ name: 'appRating', standalone: true, pure: false })
export class RatingPipe implements PipeTransform {
    private readonly translate = inject(TranslateService, { optional: true });
    private last: { value: unknown; locale: string; text: string } | null =
        null;

    transform(value: number | string | null | undefined): string {
        const locale =
            this.translate?.currentLang ||
            this.translate?.defaultLang ||
            documentLocale();
        const last = this.last;
        if (last && last.value === value && last.locale === locale) {
            return last.text;
        }
        const text = formatRating(value, locale);
        this.last = { value, locale, text };
        return text;
    }
}
