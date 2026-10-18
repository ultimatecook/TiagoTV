import {
    ratingMatchPercent,
    splitCatalogGenres,
} from './dashboard-match.utils';

describe('ratingMatchPercent', () => {
    it('reads a 0–10 rating as a percentage', () => {
        expect(ratingMatchPercent('8.2')).toBe(82);
        expect(ratingMatchPercent(7)).toBe(70);
        expect(ratingMatchPercent('9.86')).toBe(99);
    });

    it('gives null for missing or off-scale ratings', () => {
        expect(ratingMatchPercent(null)).toBeNull();
        expect(ratingMatchPercent('')).toBeNull();
        expect(ratingMatchPercent('0')).toBeNull();
        expect(ratingMatchPercent('85')).toBeNull();
        expect(ratingMatchPercent('n/a')).toBeNull();
    });
});

describe('splitCatalogGenres', () => {
    it('splits the separators catalogs use, keeping the first ones', () => {
        expect(splitCatalogGenres('Drama, Crime / Mystery|Thriller')).toEqual([
            'Drama',
            'Crime',
            'Mystery',
        ]);
        expect(splitCatalogGenres('Drama, Crime, Mystery', 2)).toEqual([
            'Drama',
            'Crime',
        ]);
    });

    it('returns nothing for an empty genre', () => {
        expect(splitCatalogGenres(undefined)).toEqual([]);
        expect(splitCatalogGenres(' , ')).toEqual([]);
    });
});
