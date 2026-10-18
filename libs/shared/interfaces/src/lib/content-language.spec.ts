import {
    categoryDisplayLabel,
    categoryDisplayLabels,
    categoryLanguageCode,
    cleanCategoryName,
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

describe('cleanCategoryName', () => {
    it.each([
        ['|ES| ✪ DAZN LA LIGA', 'DAZN LA LIGA'],
        ['|LAT|  ✪ ARGENTINA', 'ARGENTINA'],
        ['|IT|✪  DAZN EVENT', 'DAZN EVENT'],
        ['News | Live', 'News | Live'],
        ['✪ NORDIC MULTI', 'NORDIC MULTI'],
        ['|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ', 'SPAIN ᵁᴴᴰ/ᴴᴰ'],
        ['Sports', 'Sports'],
        ['|ES|', '|ES|'],
    ])('reads "%s" as "%s"', (raw, clean) => {
        expect(cleanCategoryName(raw)).toBe(clean);
    });
});

describe('categoryDisplayLabels', () => {
    it('keeps the code only where two clean names would read the same', () => {
        expect(
            categoryDisplayLabels([
                '|ES| ✪ DAZN LA LIGA',
                '|ES| ✪ MUSIC',
                '|UK| ✪ MUSIC',
                '|US| ✪ Music',
                '|LAT|  ✪ ARGENTINA',
            ])
        ).toEqual([
            'DAZN LA LIGA',
            'MUSIC · ES',
            'MUSIC · UK',
            'Music · US',
            'ARGENTINA',
        ]);
    });

    it('labels one category among its list', () => {
        const names = ['|ES| ✪ CINEMA', '|UK| ✪ CINEMA', '|ES| ✪ NBA'];
        expect(categoryDisplayLabel('|UK| ✪ CINEMA', names)).toBe(
            'CINEMA · UK'
        );
        expect(categoryDisplayLabel('|ES| ✪ NBA', names)).toBe('NBA');
        expect(categoryDisplayLabel('|FR| ✪ CINEMA', names)).toBe('CINEMA');
    });
});
