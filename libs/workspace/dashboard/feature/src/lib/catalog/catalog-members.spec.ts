import { toPlatformTitles } from '../platforms/platform-titles';
import { buildPlatformShelves } from '../platforms/streaming-platforms';
import {
    categoriesById,
    fromStoredMembers,
    membersOf,
    mergeMembers,
    platformById,
    toStoredMembers,
} from './catalog-members';

const prime = toPlatformTitles({ id: '1270', kind: 'series', language: 'EN' }, [
    { series_id: 5, name: 'The Boys' },
    { series_id: 6, name: 'Reacher' },
]);
const netflix = toPlatformTitles(
    { id: '2331', kind: 'series', language: 'ES' },
    [{ series_id: 5, name: 'The Boys' }]
);

describe('catalog members', () => {
    it("reads each category's titles from the platforms' lists", () => {
        expect(membersOf([prime, netflix])).toEqual(
            new Map([
                ['1270', new Set([5, 6])],
                ['2331', new Set([5])],
            ])
        );
    });

    it('keeps the old members of a category that did not answer', () => {
        const merged = mergeMembers(
            new Map([
                ['1270', new Set([1])],
                ['2331', new Set([2])],
            ]),
            new Map([['1270', new Set([5])]])
        );

        expect(merged).toEqual(
            new Map([
                ['1270', new Set([5])],
                ['2331', new Set([2])],
            ])
        );
    });

    it('indexes the wanted categories by title id', () => {
        const members = membersOf([prime, netflix]);

        expect(categoriesById(members, new Set(['1270']))).toEqual(
            new Map([
                [5, ['1270']],
                [6, ['1270']],
            ])
        );
    });

    it("names a title's platform in the shelves' order", () => {
        const shelves = buildPlatformShelves(
            [],
            [
                { category_id: '1270', category_name: '|EN| ✪ AMAZON-PRIME' },
                { category_id: '2331', category_name: '|ES| ✪ NETFLIX SERIES' },
            ]
        );
        const byId = platformById(
            membersOf([prime, netflix]),
            shelves,
            'series'
        );

        expect(byId.get(5)?.id).toBe('netflix');
        expect(byId.get(6)?.id).toBe('prime-video');
        expect(platformById(membersOf([prime]), shelves, 'movie').size).toBe(0);
    });

    it('stores and reads back the members, dropping junk', () => {
        const members = membersOf([prime]);

        expect(
            fromStoredMembers(
                JSON.parse(JSON.stringify(toStoredMembers(members)))
            )
        ).toEqual(members);
        expect(fromStoredMembers({ '1': [3, 'x', null], '2': 'nope' })).toEqual(
            new Map([['1', new Set([3])]])
        );
        expect(fromStoredMembers(null)).toEqual(new Map());
    });
});
