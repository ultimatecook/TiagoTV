import {
    SettingsNavGroup,
    SettingsSectionDefinition,
} from './settings-search.types';

/** Settings navigation groups in display order. */
export const SETTINGS_NAV_GROUPS: readonly {
    readonly id: SettingsNavGroup;
    readonly labelKey: string;
}[] = [
    { id: 'account', labelKey: 'SETTINGS.NAV_GROUP_ACCOUNT' },
    { id: 'app', labelKey: 'SETTINGS.NAV_GROUP_APP' },
    { id: 'library', labelKey: 'SETTINGS.NAV_GROUP_LIBRARY' },
    { id: 'devices', labelKey: 'SETTINGS.NAV_GROUP_DEVICES' },
    { id: 'data', labelKey: 'SETTINGS.NAV_DATA' },
];

/**
 * Settings section pages in navigation order. Single source for the settings
 * page navigation, the settings search index and the command palette.
 * Sections without a group (About) are pinned to the navigation footer.
 */
export const SETTINGS_SECTION_DEFINITIONS: readonly SettingsSectionDefinition[] =
    [
        {
            // TiagoTV: the sources and accounts the header bar used to
            // switch, with the keyboard shortcuts and the quick lock.
            id: 'sources',
            navLabelKey: 'SETTINGS.NAV_SOURCES',
            icon: 'account_circle',
            group: 'account',
        },
        {
            id: 'general',
            navLabelKey: 'SETTINGS.NAV_GENERAL',
            icon: 'tune',
            group: 'app',
        },
        {
            id: 'playback',
            navLabelKey: 'SETTINGS.NAV_PLAYBACK',
            icon: 'play_circle',
            group: 'app',
        },
        {
            id: 'epg',
            navLabelKey: 'SETTINGS.NAV_EPG',
            icon: 'calendar_month',
            requires: ['epg'],
            group: 'app',
        },
        {
            id: 'dashboard',
            navLabelKey: 'SETTINGS.NAV_DASHBOARD',
            icon: 'dashboard',
            group: 'app',
        },
        {
            id: 'tmdb',
            navLabelKey: 'SETTINGS.NAV_TMDB',
            icon: 'movie',
            group: 'library',
        },
        {
            id: 'parental',
            navLabelKey: 'SETTINGS.NAV_PARENTAL',
            icon: 'family_restroom',
            group: 'library',
        },
        {
            id: 'remote-control',
            navLabelKey: 'SETTINGS.NAV_REMOTE',
            icon: 'smartphone',
            requires: ['remote-control'],
            group: 'devices',
        },
        {
            id: 'server',
            navLabelKey: 'SETTINGS.NAV_SERVER',
            icon: 'dns',
            requires: ['server-storage'],
            group: 'data',
        },
        {
            id: 'backup',
            navLabelKey: 'SETTINGS.NAV_BACKUP',
            icon: 'backup',
            group: 'data',
        },
        {
            // TiagoTV: what Series, Películas and Buscar are built from.
            id: 'diagnostics',
            navLabelKey: 'SETTINGS.NAV_DIAGNOSTICS',
            icon: 'monitor_heart',
            group: 'data',
        },
        { id: 'about', navLabelKey: 'SETTINGS.NAV_ABOUT', icon: 'info' },
    ];

export function meetsSettingsRequirements(
    requires: SettingsSectionDefinition['requires'],
    capabilities: Readonly<Record<string, boolean>>
): boolean {
    return (requires ?? []).every((requirement) => capabilities[requirement]);
}
