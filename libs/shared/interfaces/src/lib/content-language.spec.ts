import {
    categoryDisplayLabel,
    categoryDisplayLabels,
    categoryLanguageCode,
    cleanCategoryName,
    isSpanishOrEnglishCategory,
} from './content-language';

describe('isSpanishOrEnglishCategory', () => {
    it('keeps Spain, Argentina, the UK and the US live', () => {
        for (const name of [
            '|ES| ✪ DAZN LA LIGA',
            '|LAT|  ✪ ARGENTINA',
            '|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT',
            '|UK| ✪ SPORTS',
            '|US| ✪ LATINO NETWORK',
        ]) {
            expect(isSpanishOrEnglishCategory(name, 'live')).toBe(true);
        }
    });

    it('drops the rest, including other countries filed under kept codes', () => {
        for (const name of [
            '|AR| ✪ BEIN SPORT HD', // Arabic, not Argentina
            '|FR| ✪ DAZN LALIGA ES',
            '|LAT| ✪ MEXICO',
            '|LAT|  ✪ GENERAL',
            '|LAT|  ✪ BR SPORTS',
            '|CA| ✪ ENGLISH CH',
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
        for (const [name, kind] of [
            ['|IT| ✪ AZIONE-AVENTURA', 'vod'],
            ['|LAT|  ✪ ARGENTINA', 'vod'],
            ['|CA| ✪ CRAVE', 'vod'],
            ['|MULTI| ✪ ENGLISH MULTISUB', 'series'],
            ['|TR| ✪ NETFLIX', 'series'],
        ] as const) {
            expect(isSpanishOrEnglishCategory(name, kind)).toBe(false);
        }
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
