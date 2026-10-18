import { displayTitle } from './display-title';

describe('displayTitle', () => {
    it.each([
        ['MUERTOS S.L. (2024) ES', 'MUERTOS S.L.'],
        ['FAUDA (2015) ES', 'FAUDA'],
        ['NORSEMEN (2016)_ENG', 'NORSEMEN'],
        ['EN - TONY - 2026', 'TONY'],
        ['|ES| Fauda [2015]', 'Fauda'],
        ['ES: La casa de papel (2017) [MULTI-SUB]', 'La casa de papel'],
        ['Dune: Part Two (2024) 4K', 'Dune: Part Two'],
        ['Breaking Bad (ES)', 'Breaking Bad'],
        ['THIS IS US (2016) ES', 'THIS IS US'],
        ['US - Reacher', 'Reacher'],
    ])('cleans "%s"', (raw, expected) => {
        expect(displayTitle(raw)).toBe(expected);
    });

    it.each([
        '1917',
        'Blade Runner 2049',
        'Spider-Man: No Way Home',
        'Us',
        'Among Us',
        'Mission: Impossible - Dead Reckoning',
        'Ocean’s Eleven',
    ])('keeps "%s" as it is', (title) => {
        expect(displayTitle(title)).toBe(title);
    });

    it('never empties a title', () => {
        expect(displayTitle('(2020)')).toBe('(2020)');
    });
});
