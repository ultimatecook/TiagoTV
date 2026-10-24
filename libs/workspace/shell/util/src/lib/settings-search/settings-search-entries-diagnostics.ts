import { SettingsSearchEntry } from './settings-search.types';

/**
 * TiagoTV's Diagnóstico rows, in page order: what Series, Películas and
 * Buscar are built from, and the catalog's last provider requests.
 */
export const DIAGNOSTICS_SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] =
    [
        {
            id: 'diagnostics-build',
            section: 'diagnostics',
            labelKey: 'SETTINGS.DIAGNOSTICS.BUILD',
            descriptionKey: 'SETTINGS.DIAGNOSTICS.BUILD_DESCRIPTION',
            keywords: [
                'diagnostics',
                'version',
                'build',
                'interface',
                'update',
            ],
        },
        {
            id: 'diagnostics-reload',
            section: 'diagnostics',
            labelKey: 'SETTINGS.DIAGNOSTICS.RELOAD',
            descriptionKey: 'SETTINGS.DIAGNOSTICS.RELOAD_DESCRIPTION',
            keywords: ['diagnostics', 'reload', 'refresh', 'catalog', 'cache'],
        },
        {
            id: 'diagnostics-opensubtitles',
            section: 'diagnostics',
            labelKey: 'SETTINGS.DIAGNOSTICS.OPEN_SUBTITLES',
            descriptionKey: 'SETTINGS.DIAGNOSTICS.OPEN_SUBTITLES_DESCRIPTION',
            keywords: ['diagnostics', 'opensubtitles', 'subtitles', 'quota'],
        },
        {
            id: 'diagnostics-catalog',
            section: 'diagnostics',
            labelKey: 'SETTINGS.DIAGNOSTICS.CATALOG',
            descriptionKey: 'SETTINGS.DIAGNOSTICS.CATALOG_DESCRIPTION',
            keywords: [
                'diagnostics',
                'catalog',
                'series',
                'movies',
                'platforms',
                'netflix',
                'import',
            ],
        },
        {
            id: 'diagnostics-requests',
            section: 'diagnostics',
            labelKey: 'SETTINGS.DIAGNOSTICS.REQUESTS',
            descriptionKey: 'SETTINGS.DIAGNOSTICS.REQUESTS_DESCRIPTION',
            keywords: [
                'diagnostics',
                'requests',
                'provider',
                'errors',
                'debug',
            ],
        },
    ];
