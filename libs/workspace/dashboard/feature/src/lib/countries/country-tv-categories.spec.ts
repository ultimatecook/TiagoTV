import { buildCountriesTv } from './countries-catalog';
import {
    countryCards,
    countryCategories,
    hasCategory,
} from './country-tv-categories';

const [SPAIN] = buildCountriesTv(
    [
        { category_id: 1, category_name: '|ES| ✪ SPAIN ᵁᴴᴰ/ᴴᴰ' },
        { category_id: 2, category_name: '|ES| ✪ DEPORTES' },
        { category_id: 3, category_name: '|ES| ✪ DAZN LA LIGA' },
        { category_id: 4, category_name: '|ES| ✪ NOTICIAS' },
    ],
    [
        { stream_id: 10, category_id: 1, name: '|ES| Antena 3' },
        { stream_id: 11, category_id: 1, name: '|ES| La 1' },
        { stream_id: 12, category_id: 1, name: '|ES| Teledeporte' },
        { stream_id: 20, category_id: 2, name: '|ES| Eurosport 1' },
        { stream_id: 21, category_id: 2, name: '|ES| Eurosport 2' },
        { stream_id: 30, category_id: 3, name: '|ES| DAZN LaLiga' },
        { stream_id: 31, category_id: 3, name: '|ES| DAZN LaLiga 2' },
        { stream_id: 32, category_id: 3, name: '|ES| DAZN LaLiga 3' },
        { stream_id: 33, category_id: 3, name: '|ES| DAZN LaLiga 4' },
        { stream_id: 40, category_id: 4, name: '|ES| 24h' },
        { stream_id: 41, category_id: 4, name: '|ES| Euronews' },
    ],
    new Date('2026-10-18T18:00:00Z')
);

const titles = (category: Parameters<typeof countryCards>[1]) =>
    countryCards(SPAIN, category).map((card) => card.channel.title);

describe('countryCategories', () => {
    it('is All, then a chip per kind of row, sports first, with counts', () => {
        expect(countryCategories(SPAIN)).toEqual([
            {
                id: 'all',
                labelKey: 'WORKSPACE.COUNTRIES.CATEGORIES.ALL',
                count: 11,
            },
            {
                id: 'sports',
                labelKey: 'WORKSPACE.COUNTRIES.CATEGORIES.SPORTS',
                count: 7,
            },
            {
                id: 'main',
                labelKey: 'WORKSPACE.COUNTRIES.CATEGORIES.MAIN',
                count: 2,
            },
            {
                id: 'news',
                labelKey: 'WORKSPACE.COUNTRIES.CATEGORIES.NEWS',
                count: 2,
            },
        ]);
    });
});

describe('countryCards', () => {
    it('lists a kind’s rows in their order, each channel once', () => {
        // Teledeporte leaves the main group for the sports row; DAZN
        // LaLiga's own category follows the kind's row.
        expect(titles('sports')).toEqual([
            'Eurosport 1',
            'Eurosport 2',
            'Teledeporte',
            'DAZN LaLiga',
            'DAZN LaLiga 2',
            'DAZN LaLiga 3',
            'DAZN LaLiga 4',
        ]);
        // The flagship channels lead the main row.
        expect(titles('main')).toEqual(['La 1', 'Antena 3']);
    });

    it('runs All through the kinds in the chips’ order', () => {
        expect(titles('all')).toEqual([
            ...titles('sports'),
            ...titles('main'),
            ...titles('news'),
        ]);
        const cards = countryCards(SPAIN, 'all');
        expect(cards[0].row.tier).toBe('sports');
        expect(cards[cards.length - 1].row.tier).toBe('news');
    });

    it('has nothing for a kind the country lacks', () => {
        const categories = countryCategories(SPAIN);
        expect(countryCards(SPAIN, 'kids')).toEqual([]);
        expect(hasCategory(categories, 'kids')).toBe(false);
        expect(hasCategory(categories, 'news')).toBe(true);
    });
});
