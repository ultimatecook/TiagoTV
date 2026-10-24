import type { TitleLanguageVersion } from '@iptvnator/services';
import {
    languageVersions,
    type PlatformTitle,
    type PlatformTitleVersion,
} from '../platforms/platform-titles';

/** Each version's stream id → the catalog title it belongs to. */
export function indexTitleVersions<T extends PlatformTitle>(
    titles: readonly T[] | null
): Map<number, T> {
    const index = new Map<number, T>();
    for (const title of titles ?? []) {
        for (const version of [title, ...title.versions]) {
            if (!index.has(version.id)) {
                index.set(version.id, title);
            }
        }
    }
    return index;
}

/**
 * The language versions a title page offers: one per language, in the
 * catalog's order (the preferred language first), the page's own one
 * marked current, each other one opening its page.
 */
export function titleLanguageVersions<T extends PlatformTitle>(
    title: T,
    currentId: number,
    open: (title: T, version: PlatformTitleVersion) => void
): TitleLanguageVersion[] {
    const current =
        title.versions.find((version) => version.id === currentId) ?? title;
    return languageVersions(title).map((version) => ({
        language: version.language,
        current: version.language === current.language,
        open: () => open(title, version),
    }));
}
