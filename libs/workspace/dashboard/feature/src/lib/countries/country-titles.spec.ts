import { tidyTitle } from './country-titles';

describe('tidyTitle', () => {
    it.each([
        ['TELEFE', 'Telefe'],
        ['AMERICA TV', 'America TV'],
        ['LA SEXTA', 'La Sexta'],
        ['TV PUBLICA', 'TV Publica'],
        ['FOX SPORTS 1', 'FOX Sports 1'],
        ['TYC SPORTS', 'TyC Sports'],
        ['SKY NEWS', 'Sky News'],
        ['CANAL DE LA CIUDAD', 'Canal de la Ciudad'],
        ['NBC (KARE)', 'NBC (KARE)'],
        ['UNIVISION 23 [MIAMI FLORIDA]', 'Univision 23 [Miami Florida]'],
        ['C5N', 'C5N'],
        ['ESPN', 'ESPN'],
    ])('writes "%s" as "%s"', (raw, tidy) => {
        expect(tidyTitle(raw)).toBe(tidy);
    });

    it('leaves a name with lower case as the provider wrote it', () => {
        expect(tidyTitle('BBC One EAST e')).toBe('BBC One EAST e');
        expect(tidyTitle('M+ LaLigaTV FHD Orange')).toBe(
            'M+ LaLigaTV FHD Orange'
        );
    });
});
