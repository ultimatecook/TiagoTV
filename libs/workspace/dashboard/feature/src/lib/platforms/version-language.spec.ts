import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '@iptvnator/services';
import {
    aggregateCatalog,
    type PlatformTitleList,
} from '../catalog/catalog-titles';
import { catalogTitles, listsView } from '../catalog/catalog-list-views';
import { toPlatformTitles, type PlatformCatalogItem } from './platform-titles';
import { mergePlatformTitles } from './platform-versions';
import {
    findStreamingPlatform,
    type PlatformCategory,
    type StreamingPlatform,
} from './streaming-platforms';
import {
    PREFERRED_VERSION_LANGUAGE,
    preferredVersionLanguage,
} from './version-language';

const NETFLIX = findStreamingPlatform('netflix') as StreamingPlatform;
const esShows: PlatformCategory = {
    id: '2331',
    kind: 'series',
    language: 'ES',
};
const enShows: PlatformCategory = { id: '482', kind: 'series', language: 'EN' };
const show = (id: number, name: string): PlatformCatalogItem => ({
    series_id: id,
    name,
    cover: `http://img/${id}.jpg`,
    last_modified: String(1000 - id),
});
const spanish = toPlatformTitles(esShows, [
    show(2, 'MUERTOS S.L. (2024) ES'),
    show(5, 'LA REVUELTA (2025) ES'),
]);
const english = toPlatformTitles(enShows, [show(13, 'DEATH INC. (2024)_ENG')]);
// One show per card: the English entry shares the Spanish one's poster.
english[0] = { ...english[0], poster: spanish[0].poster };

describe('version language', () => {
    it('opens the original (English) version unless the dub was chosen', () => {
        expect(preferredVersionLanguage(undefined)).toBe('EN');
        expect(preferredVersionLanguage('original')).toBe('EN');
        expect(preferredVersionLanguage('es')).toBe('ES');
    });

    it('follows Settings → Playback → Audio language, original for existing users', () => {
        const audioLanguage = signal<string | undefined>(undefined);
        TestBed.configureTestingModule({
            providers: [
                { provide: SettingsStore, useValue: { audioLanguage } },
            ],
        });
        const preferred = TestBed.inject(PREFERRED_VERSION_LANGUAGE);

        expect(preferred()).toBe('EN');
        audioLanguage.set('es');
        expect(preferred()).toBe('ES');
    });

    it('shows and opens the English version, keeping one title per show', () => {
        const titles = mergePlatformTitles([spanish, english], 'EN');

        expect(titles.map((title) => title.title)).toEqual([
            'DEATH INC.',
            'LA REVUELTA',
        ]);
        expect(titles[0]).toMatchObject({ id: 13, language: 'EN' });
        // The page and the play buttons open versions[0].
        expect(titles[0].versions.map((version) => version.language)).toEqual([
            'EN',
            'ES',
        ]);
        // A show filed in Spanish only stays Spanish.
        expect(titles[1]).toMatchObject({ id: 5, language: 'ES' });
    });

    it('shows the Spanish version with the dub chosen', () => {
        const titles = mergePlatformTitles([spanish, english], 'ES');

        expect(titles[0]).toMatchObject({ id: 2, title: 'MUERTOS S.L.' });
        expect(titles[0].versions[0].language).toBe('ES');
    });

    it('carries the preference through Series / Películas and the platform lists', () => {
        const lists: PlatformTitleList[] = [
            { platform: NETFLIX, titles: [...spanish, ...english] },
        ];
        expect(aggregateCatalog(lists, 'series', 'EN')[0].title).toBe(
            'DEATH INC.'
        );
        expect(aggregateCatalog(lists, 'series', 'ES')[0].title).toBe(
            'MUERTOS S.L.'
        );

        const lookup = {
            titlesOf: (category: PlatformCategory) =>
                category.language === 'ES' ? spanish : english,
            failed: () => false,
        };
        const view = listsView(
            [{ platform: NETFLIX, categories: [esShows, enShows] }],
            'series',
            lookup,
            'EN'
        );
        expect(view.lists[0].titles[0].title).toBe('DEATH INC.');
        expect(
            catalogTitles('series', view, {
                stored: null,
                expected: true,
                busy: false,
                failed: () => false,
                preferred: 'EN',
            })?.[0]
        ).toMatchObject({ id: 13, platform: NETFLIX });
    });
});
