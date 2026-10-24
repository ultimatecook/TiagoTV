import type { PlatformTitle } from '../platforms/platform-titles';
import { indexTitleVersions, titleLanguageVersions } from './title-versions';

const title: PlatformTitle = {
    id: 13,
    kind: 'series',
    categoryId: '482',
    title: 'DEATH INC.',
    poster: null,
    language: 'EN',
    added: 1,
    genres: [],
    rating: null,
    plot: null,
    backdrop: null,
    tmdb: null,
    year: 2024,
    versions: [
        { id: 13, categoryId: '482', language: 'EN', title: 'DEATH INC.' },
        { id: 2, categoryId: '2331', language: 'ES', title: 'MUERTOS S.L.' },
        { id: 9, categoryId: '2332', language: 'ES', title: 'MUERTOS S.L. 4K' },
    ],
};

describe('title language versions', () => {
    it('finds the catalog title by any of its versions', () => {
        const index = indexTitleVersions([title]);

        expect(index.get(13)).toBe(title);
        expect(index.get(2)).toBe(title);
        expect(index.get(9)).toBe(title);
        expect(indexTitleVersions(null).size).toBe(0);
    });

    it("offers one version per language, the page's own as current", () => {
        const open = jest.fn();

        const onSpanishPage = titleLanguageVersions(title, 9, open);

        expect(
            onSpanishPage.map(({ language, current }) => ({
                language,
                current,
            }))
        ).toEqual([
            { language: 'EN', current: false },
            { language: 'ES', current: true },
        ]);
        onSpanishPage[0].open();
        expect(open).toHaveBeenCalledWith(title, title.versions[0]);
    });
});
