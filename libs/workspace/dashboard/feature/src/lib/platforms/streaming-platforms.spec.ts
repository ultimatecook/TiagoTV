import {
    buildGenreCategories,
    buildPlatformShelves,
    findStreamingPlatform,
    isKeptPlatformCategory,
    platformLanguage,
} from './streaming-platforms';

const vod = [
    { category_id: 1125, category_name: '|EN| ✪ Netflix MULTI SUB' },
    { category_id: 1610, category_name: '|ES| ✪ ORIGINAL NETFLIX' },
    { category_id: 2541, category_name: '|ES| ✪ MOVISTAR +' },
    { category_id: 9001, category_name: '|FR| ✪ NETFLIX' },
    { category_id: 2344, category_name: '|EN| ✪ IMAX MOVIES' },
];
const series = [
    { category_id: 482, category_name: '|EN| ✪ NETFLIX' },
    { category_id: 2331, category_name: '|ES| ✪ NETFLIX SERIES' },
    { category_id: 1270, category_name: '|EN| ✪ AMAZON-PRIME' },
    { category_id: 2330, category_name: '|ES| ✪ HBO-MAX' },
    { category_id: 483, category_name: '|EN| ✪ HBO' },
    { category_id: 9002, category_name: '|BR| ✪ DISNEY+' },
];

describe('streaming platforms', () => {
    it('shows the platforms the source carries in Spanish or English', () => {
        const shelves = buildPlatformShelves(vod, series);

        expect(shelves.map((shelf) => shelf.platform.id)).toEqual([
            'netflix',
            'prime-video',
            'hbo-max',
            'movistar-plus',
        ]);
        expect(shelves[0].categories).toEqual([
            { id: '1125', kind: 'movie', language: 'EN' },
            { id: '1610', kind: 'movie', language: 'ES' },
            { id: '482', kind: 'series', language: 'EN' },
            { id: '2331', kind: 'series', language: 'ES' },
        ]);
    });

    it("keeps a platform's multi-language category without a code", () => {
        const shelves = buildPlatformShelves(
            [
                {
                    category_id: 1535,
                    category_name: '✪ ORIGINAL AMAZON  MULTI',
                },
                { category_id: 1536, category_name: '✪ NORDIC MULTI' },
                { category_id: 1537, category_name: '|FR| ✪ NETFLIX MULTI' },
            ],
            []
        );

        expect(shelves).toEqual([
            {
                platform: expect.objectContaining({ id: 'prime-video' }),
                categories: [{ id: '1535', kind: 'movie', language: 'EN' }],
            },
        ]);
        expect(
            isKeptPlatformCategory('✪ ORIGINAL AMAZON  MULTI', 'movie')
        ).toBe(true);
        expect(isKeptPlatformCategory('✪ ORIGINAL TABII MULTI', 'movie')).toBe(
            false
        );
    });

    it('reads |LAT| as Spanish', () => {
        expect(platformLanguage('|LAT| ✪ NETFLIX')).toBe('ES');
        expect(platformLanguage('|EN| ✪ HULU')).toBe('EN');
    });

    it('reads the genre categories, not the platforms', () => {
        const genres = buildGenreCategories([
            { category_id: 11, category_name: '|EN| ✪ HORROR' },
            { category_id: 12, category_name: '|ES| ✪ ACCIÓN Y AVENTURA' },
            { category_id: 13, category_name: '|ES| ✪ NETFLIX SERIES' },
        ]);

        expect([...genres.entries()]).toEqual([
            ['11', ['horror']],
            ['12', ['action', 'adventure']],
        ]);
    });

    it('finds a platform by its route id', () => {
        expect(findStreamingPlatform('disney-plus')?.name).toBe('Disney+');
        expect(findStreamingPlatform('nope')).toBeNull();
    });
});
