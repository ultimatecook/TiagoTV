import { categoryLanguageCode } from '@iptvnator/shared/interfaces';
import {
    COUNTRIES,
    countryOfCategory,
    findCountryDefinition,
} from './countries';

function countryOf(name: string): string | null {
    return countryOfCategory(categoryLanguageCode(name), name)?.id ?? null;
}

describe('countryOfCategory', () => {
    it.each([
        ['|ES| ✪ DAZN LA LIGA', 'es'],
        ['|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ', 'es'],
        ['|US| ✪ NEWS', 'us'],
        ['|CA| ✪ ENGLISH CH', 'ca'],
        ['|UK| ✪ SPORTS', 'gb'],
        ['|UK| ✪ IRELAND SPORT EVENT', 'ie'],
        ['|LAT|  ✪ ARGENTINA', 'ar'],
        ['|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT', 'ar'],
        ['|LAT| ✪ MEXICO', 'mx'],
        ['|LAT| ✪ MÉXICO', 'mx'],
        ['|LAT|  ✪ EL SALVADOR', 'sv'],
        ['|LAT|  ✪ PUERTO RICO', 'pr'],
        ['|LAT| ✪ REP. DOMINICANA', 'do'],
        ['|LAT|  ✪ GENERAL', 'latam'],
        ['|LAT|  ✪ CARRIBEAN', 'latam'],
    ])('files "%s" under %s', (name, id) => {
        expect(countryOf(name)).toBe(id);
    });

    it.each([
        // |AR| is Arabic on these panels, not Argentina.
        '|AR| ✪ MBC',
        '|EN| ✪ ACTION',
        '|IT| ✪ SPORT',
        'NO CODE',
    ])('files "%s" nowhere', (name) => {
        expect(countryOf(name)).toBeNull();
    });
});

describe('COUNTRIES', () => {
    it('lists Argentina first in Latin America and its own groups last', () => {
        const latam = COUNTRIES.filter((country) => country.region === 'latam');
        expect(latam[0].id).toBe('ar');
        expect(latam[latam.length - 1].id).toBe('latam');
    });

    it('bundles a flag for every country but Latin America itself', () => {
        for (const country of COUNTRIES) {
            expect(country.flag).toBe(
                country.id === 'latam'
                    ? null
                    : `./assets/flags/${country.id}.svg`
            );
        }
    });

    it('finds a country by its route id', () => {
        expect(findCountryDefinition('ar')?.nameKey).toBe(
            'WORKSPACE.COUNTRIES.NAMES.AR'
        );
        expect(findCountryDefinition('xx')).toBeNull();
    });
});
