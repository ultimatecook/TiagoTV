import { TestBed } from '@angular/core/testing';
import { patchState, signalStore, withState } from '@ngrx/signals';
import { withSelection } from './with-selection.feature';

/**
 * TiagoTV keeps the catalog views to Spanish and English: the rail lists
 * the kept categories, "All items" their items, and idle event slots
 * ("ES | No Event") appear nowhere. The stored catalog stays complete.
 */
const liveCategories = [
    { category_id: '2552', category_name: '|ES| ✪ DAZN LA LIGA' },
    { category_id: '902', category_name: '|FR| ✪ DAZN EVENT' },
    { category_id: '1464', category_name: '|UK| ✪ LIVE EVENT' },
    { category_id: '1361', category_name: '|DE| ✪ DAZN EVENT' },
];

const liveStreams = [
    { xtream_id: 1, category_id: '2552', name: '|ES| DAZN LALIGA', added: '9' },
    { xtream_id: 2, category_id: '2552', name: 'ES | No Event', added: '8' },
    {
        xtream_id: 3,
        category_id: '1464',
        name: 'Live | Leeds United - Manchester United | Premier League | ES',
        added: '7',
    },
    { xtream_id: 4, category_id: '902', name: 'FR | No Event', added: '6' },
    {
        xtream_id: 5,
        category_id: '902',
        name: 'End | Udinese vs. Lecce | Serie A Enilive | FR',
        added: '5',
    },
    { xtream_id: 6, category_id: '1361', name: 'DE | No Event', added: '4' },
];

const vodCategories = [
    { category_id: '10', category_name: '|ES| ✪ COMEDIA' },
    { category_id: '20', category_name: '|IT| ✪ COMMEDIA' },
    { category_id: '30', category_name: '|EN| ✪ ACTION' },
];

const vodStreams = [
    { xtream_id: 11, category_id: '10', title: 'Torrente', added: '3' },
    { xtream_id: 12, category_id: '20', title: 'Fantozzi', added: '2' },
    { xtream_id: 13, category_id: '30', title: 'Heat', added: '1' },
];

const serialCategories = [
    { category_id: '40', category_name: '|EN| ✪ HBO' },
    { category_id: '50', category_name: '|TR| ✪ NETFLIX' },
];

const serialStreams = [
    { xtream_id: 21, category_id: '40', title: 'The Wire', last_modified: '2' },
    { xtream_id: 22, category_id: '50', title: 'Ezel', last_modified: '1' },
];

const LanguageSelectionStore = signalStore(
    { protectedState: false },
    withState({
        contentLoadStateByType: {
            live: 'ready',
            vod: 'ready',
            series: 'ready',
        },
        liveCategories,
        liveStreams,
        vodCategories,
        vodStreams,
        serialCategories,
        serialStreams,
    }),
    withSelection()
);

const ids = (items: ReadonlyArray<{ readonly [key: string]: unknown }>) =>
    items.map((item) => item['xtream_id'] ?? item['category_id']);

describe('withSelection language scope', () => {
    let store: InstanceType<typeof LanguageSelectionStore>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [LanguageSelectionStore],
        });
        store = TestBed.inject(LanguageSelectionStore);
    });

    it('lists only the Spanish and English categories in the rails', () => {
        store.setSelectedContentType('live');
        expect(ids(store.getDisplayedCategoriesBySelectedType())).toEqual([
            '2552',
            '1464',
        ]);

        store.setSelectedContentType('vod');
        expect(ids(store.getDisplayedCategoriesBySelectedType())).toEqual([
            '10',
            '30',
        ]);

        store.setSelectedContentType('series');
        expect(ids(store.getDisplayedCategoriesBySelectedType())).toEqual([
            '40',
        ]);

        // The full list stays available to non-view logic.
        expect(store.getCategoriesBySelectedType()).toHaveLength(2);
    });

    it('fills "All items" from the kept categories, without idle slots', () => {
        store.setSelectedContentType('live');
        store.setSelectedCategory(null);

        expect(ids(store.getPaginatedContent())).toEqual([1, 3]);
        // The count badge reads the same list.
        expect(store.selectItemsFromSelectedCategory()).toHaveLength(2);
        expect(store.hasMoreContent()).toBe(false);

        store.setSelectedContentType('vod');
        expect(ids(store.selectItemsFromSelectedCategory())).toEqual([11, 13]);

        store.setSelectedContentType('series');
        expect(ids(store.selectItemsFromSelectedCategory())).toEqual([21]);
    });

    it('searches "All items" within the kept languages only', () => {
        store.setSelectedContentType('live');
        store.setCategorySearchTerm('udinese');
        expect(store.selectItemsFromSelectedCategory()).toEqual([]);

        store.setCategorySearchTerm('no event');
        expect(store.selectItemsFromSelectedCategory()).toEqual([]);

        store.setCategorySearchTerm('leeds');
        expect(ids(store.selectItemsFromSelectedCategory())).toEqual([3]);
    });

    it('drops idle event slots from a category and from its count', () => {
        store.setSelectedContentType('live');
        store.setSelectedCategory(2552);

        expect(ids(store.selectItemsFromSelectedCategory())).toEqual([1]);
        expect(store.getCategoryItemCounts().get(2552)).toBe(1);
        expect(store.getCategoryItemCounts().get(1361)).toBeUndefined();
    });

    it('exposes the scoped items of every type for all-sources views', () => {
        expect(ids(store.getDisplayedContentByType()('vod'))).toEqual([11, 13]);
        expect(ids(store.getDisplayedContentByType()('live'))).toEqual([1, 3]);
    });

    it('follows the catalog when the playlist changes', () => {
        store.setSelectedContentType('vod');
        expect(store.selectItemsFromSelectedCategory()).toHaveLength(2);

        // Another provider without language codes: nothing is hidden.
        patchState(store, {
            vodCategories: [{ category_id: '1', category_name: 'Movies' }],
            vodStreams: [
                { xtream_id: 31, category_id: '1', title: 'A', added: '1' },
                { xtream_id: 32, category_id: '2', title: 'B', added: '2' },
            ],
        });

        expect(ids(store.getDisplayedCategoriesBySelectedType())).toEqual([
            '1',
        ]);
        expect(ids(store.selectItemsFromSelectedCategory())).toEqual([32, 31]);
    });
});
