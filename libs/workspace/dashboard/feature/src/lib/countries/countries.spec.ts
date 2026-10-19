import { categoryLanguageCode } from '@iptvnator/shared/interfaces';
import {
    COUNTRIES,
    countryOfCategory,
    findCountryDefinition,
} from './countries';

function placeOf(name: string): string | null {
    const place = countryOfCategory(categoryLanguageCode(name), name);
    return place ? `${place.country.id}${place.irish ? ' (IE)' : ''}` : null;
}

describe('countryOfCategory', () => {
    it.each([
        ['|ES| ✪ DAZN LA LIGA', 'es'],
        ['|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ', 'es'],
        ['|US| ✪ NEWS', 'us'],
        ['|US| ✪ LOCAL - NBC', 'us'],
        ['|UK| ✪ SPORTS', 'gb'],
        ['|UK| ✪ IRELAND', 'gb (IE)'],
        ['|UK| ✪ IRELAND SPORT EVENT', 'gb (IE)'],
        ['|LAT|  ✪ ARGENTINA', 'ar'],
        ['|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT', 'ar'],
    ])('files "%s" under %s', (name, place) => {
        expect(placeOf(name)).toBe(place);
    });

    it.each([
        // |AR| is Arabic on these panels, not Argentina.
        '|AR| ✪ MBC',
        '|LAT| ✪ MEXICO',
        '|LAT|  ✪ GENERAL',
        '|CA| ✪ ENGLISH CH',
        '|EN| ✪ ACTION',
        '|IT| ✪ SPORT',
        'NO CODE',
    ])('files "%s" nowhere', (name) => {
        expect(placeOf(name)).toBeNull();
    });
});

describe('COUNTRIES', () => {
    it('runs Argentina, Spain, the United Kingdom, the United States', () => {
        expect(COUNTRIES.map((country) => country.id)).toEqual([
            'ar',
            'es',
            'gb',
            'us',
        ]);
    });

    it('bundles a flag for every country', () => {
        for (const country of COUNTRIES) {
            expect(country.flag).toBe(`./assets/flags/${country.id}.svg`);
        }
    });

    it('finds a country by its route id, Ireland in the United Kingdom', () => {
        expect(findCountryDefinition('ar')?.nameKey).toBe(
            'WORKSPACE.COUNTRIES.NAMES.AR'
        );
        expect(findCountryDefinition('ie')?.id).toBe('gb');
        expect(findCountryDefinition('mx')).toBeNull();
        expect(findCountryDefinition('')).toBeNull();
    });
});
