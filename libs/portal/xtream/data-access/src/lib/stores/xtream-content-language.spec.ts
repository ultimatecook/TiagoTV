import {
    filterCategoriesByLanguage,
    isIdleLiveItem,
    scopeCatalogByLanguage,
} from './xtream-content-language';

const pwaLiveCategories = [
    { category_id: '2552', category_name: '|ES| ✪ DAZN LA LIGA' },
    { category_id: '902', category_name: '|FR| ✪ DAZN EVENT' },
    { category_id: '1464', category_name: '|UK| ✪ LIVE EVENT' },
    { category_id: '1360', category_name: '|IT|✪  DAZN EVENT' },
];

const pwaLiveStreams = [
    { xtream_id: 1, category_id: '2552', name: '|ES| DAZN LALIGA ᴴᴰ' },
    { xtream_id: 2, category_id: '2552', name: 'ES | No Event' },
    {
        xtream_id: 3,
        category_id: '1464',
        name: 'Live | Leeds United - Manchester United | Premier League | ES',
    },
    { xtream_id: 4, category_id: '902', name: 'FR | No Event' },
    {
        xtream_id: 5,
        category_id: '902',
        name: 'End | Udinese vs. Lecce | Serie A Enilive | FR',
    },
    { xtream_id: 6, category_id: '1360', name: 'IT | No Event' },
];

describe('xtream content language scope', () => {
    it('lists the Spanish and English categories only', () => {
        expect(
            filterCategoriesByLanguage(pwaLiveCategories, 'live').map(
                (category) => category.category_id
            )
        ).toEqual(['2552', '1464']);
    });

    it('keeps every category of a provider that tags none by language', () => {
        const untagged = [
            { category_id: '1', category_name: 'News' },
            { category_id: '2', category_name: 'Sports' },
        ];
        expect(filterCategoriesByLanguage(untagged, 'live')).toBe(untagged);
    });

    it('scopes "All items" to the listed categories without idle slots', () => {
        const scoped = scopeCatalogByLanguage(
            pwaLiveCategories,
            pwaLiveStreams,
            'live'
        );

        expect(scoped.allItems.map((item) => item.xtream_id)).toEqual([1, 3]);
        // A category opened on its own still lists its playable items.
        expect(scoped.items.map((item) => item.xtream_id)).toEqual([1, 3, 5]);
    });

    it('leaves out a live category that holds idle slots only', () => {
        const scoped = scopeCatalogByLanguage(
            [
                { category_id: '1732', category_name: '|ES| ✪ ROLAND-GARROS' },
                { category_id: '2552', category_name: '|ES| ✪ DAZN LA LIGA' },
                { category_id: '7', category_name: '|ES| ✪ EMPTY' },
            ],
            [
                { category_id: '1732', name: 'ES | No Event' },
                { category_id: '1732', name: 'ES | No Event' },
                { category_id: '2552', name: 'ES | No Event' },
                { category_id: '2552', name: '|ES| DAZN LALIGA' },
            ],
            'live'
        );

        // An empty category is the provider's; only idle-only ones go.
        expect(
            scoped.categories.map((category) => category.category_id)
        ).toEqual(['2552', '7']);
        expect(scoped.allItems).toEqual([
            { category_id: '2552', name: '|ES| DAZN LALIGA' },
        ]);
    });

    it('joins Electron rows through the SQLite category id', () => {
        const scoped = scopeCatalogByLanguage(
            [
                { id: 11, name: '|EN| ✪ ACTION', xtream_id: 400 },
                { id: 12, name: '|DE| ✪ ACTION', xtream_id: 401 },
            ],
            [
                { xtream_id: 21, category_id: 11, title: 'Heat (1995)' },
                { xtream_id: 22, category_id: 12, title: 'Heat (1995) DE' },
            ],
            'vod'
        );

        expect(scoped.categories.map((category) => category.id)).toEqual([11]);
        expect(scoped.allItems.map((item) => item.xtream_id)).toEqual([21]);
    });

    it('never treats a movie or series as an idle event slot', () => {
        const scoped = scopeCatalogByLanguage(
            [{ category_id: '7', category_name: '|ES| ✪ COMEDIA' }],
            [{ category_id: '7', name: 'ES | No Event' }],
            'vod'
        );
        expect(scoped.allItems).toHaveLength(1);
        expect(isIdleLiveItem({ title: 'UK | No Event' })).toBe(true);
    });
});
