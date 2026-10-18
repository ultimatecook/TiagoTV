import {
    categoryLanguageCode,
    isSpanishOrEnglishCategory,
} from './content-language';

describe('isSpanishOrEnglishCategory', () => {
    it('keeps Spain, Latin America, the UK, the US and English Canada live', () => {
        for (const name of [
            '|ES| ✪ DAZN LA LIGA',
            '|LAT|  ✪ ARGENTINA',
            '|LAT| ✪ MEXICO',
            '|UK| ✪ SPORTS',
            '|US| ✪ LATINO NETWORK',
            '|CA| ✪ ENGLISH CH',
        ]) {
            expect(isSpanishOrEnglishCategory(name, 'live')).toBe(true);
        }
    });

    it('drops other languages, including those filed under kept codes', () => {
        for (const name of [
            '|AR| ✪ BEIN SPORT HD', // Arabic, not Argentina
            '|FR| ✪ DAZN LALIGA ES',
            '|LAT|  ✪ BR SPORTS',
            '|LAT| ✪ BRAZIL',
            '|CA| ✪ QUEBEC SPORT',
            '|UK| ✪ ARABIC TV',
            '|UK| ✪ ASIA EU',
            '✪ NORDIC MULTI',
        ]) {
            expect(isSpanishOrEnglishCategory(name, 'live')).toBe(false);
        }
    });

    it('keeps Spanish and English movies and series only', () => {
        expect(isSpanishOrEnglishCategory('|ES| ✪ PELICULAS 2024', 'vod')).toBe(
            true
        );
        expect(isSpanishOrEnglishCategory('|EN| ✪ ACTION', 'vod')).toBe(true);
        expect(
            isSpanishOrEnglishCategory('|IT| ✪ AZIONE-AVENTURA', 'vod')
        ).toBe(false);
        expect(
            isSpanishOrEnglishCategory('|MULTI| ✪ ENGLISH MULTISUB', 'series')
        ).toBe(true);
        expect(isSpanishOrEnglishCategory('|TR| ✪ NETFLIX', 'series')).toBe(
            false
        );
        expect(categoryLanguageCode('|LAT|  ✪ CHILE')).toBe('LAT');
    });
});
