import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { formatRating } from './rating-format.util';
import { RatingPipe } from './rating.pipe';

describe('formatRating', () => {
    it('uses the language decimal separator', () => {
        expect(formatRating(7.2, 'es')).toBe('7,2');
        expect(formatRating('7.2', 'es')).toBe('7,2');
        expect(formatRating('7,2', 'en')).toBe('7.2');
        expect(formatRating(8, 'es')).toBe('8,0');
        expect(formatRating(7.25, 'en')).toBe('7.3');
    });

    it('keeps text that is no number and drops empty values', () => {
        expect(formatRating('PG-13', 'es')).toBe('PG-13');
        expect(formatRating('', 'es')).toBe('');
        expect(formatRating(null, 'es')).toBe('');
        expect(formatRating(undefined, 'es')).toBe('');
    });

    it('falls back to English for a language Intl does not know', () => {
        expect(formatRating(7.2, 'zz-invalid-??')).toBe('7.2');
    });
});

describe('RatingPipe', () => {
    it('follows the current app language', () => {
        const translate = { currentLang: 'es', defaultLang: 'en' };
        TestBed.configureTestingModule({
            providers: [{ provide: TranslateService, useValue: translate }],
        });
        const pipe = TestBed.runInInjectionContext(() => new RatingPipe());

        expect(pipe.transform('7.2')).toBe('7,2');
        translate.currentLang = 'en';
        expect(pipe.transform('7.2')).toBe('7.2');
    });
});
