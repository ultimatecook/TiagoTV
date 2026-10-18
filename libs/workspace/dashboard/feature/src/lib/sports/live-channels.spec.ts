import { brandOfFamily, buildLiveChannels } from './live-channels';
import type {
    SportsCatalogCategory,
    SportsCatalogStream,
} from './sports-catalog';

const categories: SportsCatalogCategory[] = [
    { category_id: 1, category_name: '|LAT|  ✪ ARGENTINA' },
    { category_id: 2, category_name: '|LAT|  ✪ GENERAL' },
    { category_id: 3, category_name: '|US| ✪ SPORTS' },
    { category_id: 4, category_name: '|ES| ✪ DEPORTES' },
    { category_id: 5, category_name: '|ES| ✪ DAZN LIVE' },
    // Arabic, not Argentina.
    { category_id: 6, category_name: '|AR| ✪ BEIN SPORT HD' },
    { category_id: 7, category_name: '|LAT|  ✪ BR SPORTS' },
];

let nextId = 100;
function stream(
    name: string,
    categoryId: number,
    icon: string | null = null
): SportsCatalogStream {
    return {
        stream_id: nextId++,
        name,
        stream_icon: icon,
        category_id: categoryId,
    };
}

const streams = [
    stream('|US| ESPN 2 ᴴᴰ', 3),
    stream('|US| ESPN USA', 3),
    stream('|LAM| ESPN', 2),
    stream('|ARG| ESPN', 1, 'http://logos.example/espn.png'),
    stream('|ARG| ESPN 2', 1),
    stream('|LATIN| ESPN 4 (BRASIL)', 2),
    stream('|ARG| TYC SPORTS ᴬᴿᴳᴱᴺᵀᴵᴺᴬ ᴴᴰ', 1),
    stream('|ES| DAZN 2 ᴴᴰ', 5),
    stream('|ES| DAZN 1 ᴴᴰ', 5),
    stream('|ES| M+ LaLiga TV', 4),
    stream('|ES| M. Deportes 2 ᴴᴰ', 4),
    stream('|ES| M. Deportes 1 ᴴᴰ', 4),
    stream('|AR| BEIN SPORTS 1', 6),
    stream('|BR| ESPN', 7),
    stream('|ES| Teledeporte', 4),
    stream('Live | Leeds United - Manchester United | Premier League | ES', 4),
];

describe('buildLiveChannels', () => {
    const tiles = buildLiveChannels(categories, streams);
    const byBrand = new Map(tiles.map((tile) => [tile.brand.id, tile]));

    it('shows the curated brands the source carries, in their order', () => {
        expect(tiles.map((tile) => tile.brand.id)).toEqual([
            'espn',
            'tyc-sports',
            'dazn',
            'movistar-plus',
        ]);
    });

    it("plays the brand's main feed, Argentina's first", () => {
        const espn = byBrand.get('espn');

        expect(espn?.channel.streamId).toBe(103);
        expect(espn?.channel.title).toBe('ESPN');
        expect(espn?.icon).toBe('http://logos.example/espn.png');
        expect(byBrand.get('dazn')?.channel.title).toBe('DAZN 1');
    });

    it('takes the most wanted family of a brand', () => {
        expect(byBrand.get('movistar-plus')?.channel.title).toBe(
            'Movistar Deportes 1'
        );
    });

    it('leaves out Arabic and Portuguese feeds', () => {
        expect(byBrand.has('bein-sports')).toBe(false);
        const ids = tiles.map((tile) => tile.channel.streamId);
        expect(ids).not.toContain(105);
        expect(ids).not.toContain(113);
    });
});

describe('brandOfFamily', () => {
    it('finds the brand of a competition channel', () => {
        expect(brandOfFamily('dazn laliga')?.id).toBe('dazn');
        expect(brandOfFamily('m+ liga de campeones')?.id).toBe('movistar-plus');
        expect(brandOfFamily('laliga hypermotion')).toBeNull();
    });
});
