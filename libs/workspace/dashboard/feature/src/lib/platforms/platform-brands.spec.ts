import { brandOf, buildBrandRows } from './platform-brands';
import type { PlatformGenre } from './platform-genres';
import type { PlatformTitle } from './platform-titles';

let nextId = 1;

function title(
    name: string,
    genres: readonly PlatformGenre[] = []
): PlatformTitle {
    return {
        id: nextId++,
        kind: 'series',
        categoryId: '1720',
        title: name,
        poster: null,
        language: 'ES',
        added: 0,
        genres,
        rating: null,
        plot: null,
        backdrop: null,
    };
}

describe('platform brands', () => {
    it('knows a brand by the titles it is known for, in both languages', () => {
        expect(brandOf(title('The Mandalorian'))).toBe('star-wars');
        expect(brandOf(title('La guerra de las galaxias'))).toBe('star-wars');
        expect(brandOf(title('Loki'))).toBe('marvel');
        expect(brandOf(title('Los Vengadores'))).toBe('marvel');
        expect(brandOf(title('Toy Story 4'))).toBe('pixar');
        expect(brandOf(title('Intensamente 2'))).toBe('pixar');
        expect(brandOf(title('Frozen II'))).toBe('disney');
        expect(brandOf(title('Planeta Tierra Nat Geo'))).toBe(
            'national-geographic'
        );
    });

    it('falls back on genres, and leaves the rest alone', () => {
        expect(brandOf(title('Planeta océano', ['documentary']))).toBe(
            'national-geographic'
        );
        expect(brandOf(title('Bluey'))).toBe('disney');
        expect(brandOf(title('Un cuento', ['animation']))).toBe('disney');
        expect(brandOf(title('The Bear', ['comedy']))).toBeNull();
        // Short names match whole, not inside other titles.
        expect(brandOf(title('Up in the Air'))).toBeNull();
        expect(brandOf(title('Red Notice'))).toBeNull();
    });

    it("rows the brands in Disney+'s order, the empty ones left out", () => {
        const rows = buildBrandRows(
            [
                title('Andor'),
                title('WandaVision'),
                title('Encanto'),
                title('Ahsoka'),
                title('The Bear'),
            ],
            'Disney+'
        );

        expect(rows.map((row) => row.id)).toEqual([
            'brand-disney',
            'brand-marvel',
            'brand-star-wars',
        ]);
        expect(rows[2]).toMatchObject({
            labelKey: 'WORKSPACE.PLATFORMS.BRAND_ROW',
            labelParams: { brand: 'Star Wars', platform: 'Disney+' },
            brand: { id: 'star-wars', name: 'Star Wars' },
        });
        expect(rows[2].titles.map((item) => item.title)).toEqual([
            'Andor',
            'Ahsoka',
        ]);
        expect(buildBrandRows([title('The Bear')], 'Disney+')).toEqual([]);
    });
});
