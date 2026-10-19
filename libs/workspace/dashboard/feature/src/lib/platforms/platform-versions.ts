import type { PlatformTitle, PlatformTitleVersion } from './platform-titles';
import type { PlatformLanguage } from './streaming-platforms';

/**
 * A platform's catalog files a show once per language, each version under
 * its own name and stream: "MUERTOS S.L." in |ES| ✪ ORIGINAL NETFLIX and
 * "DEATH INC." in |EN| ✪ NETFLIX. The page shows one card per title, in
 * the user's language where there is a Spanish version, with the others
 * kept as its versions.
 *
 * Two entries are one title when they share a TMDB id; or, failing that,
 * the same name and year (a missing year agrees) or the same poster. A
 * poster more than six entries share is the provider's placeholder and
 * joins nothing. Entries whose TMDB ids or years disagree are never joined.
 */
const MAX_POSTER_SHARERS = 6;
/** Release dates differ by country around the new year. */
const YEAR_TOLERANCE = 1;

/** Newest first; one title per show, whatever its languages and categories. */
export function mergePlatformTitles(
    lists: readonly (readonly PlatformTitle[])[],
    preferred: PlatformLanguage = 'ES'
): PlatformTitle[] {
    const titles = distinct(lists);
    return groupVersions(titles)
        .map((group) => mergeVersions(group, preferred))
        .sort((a, b) => b.added - a.added);
}

/** A title filed in two of the platform's categories, once. */
function distinct(
    lists: readonly (readonly PlatformTitle[])[]
): PlatformTitle[] {
    const seen = new Set<string>();
    const titles: PlatformTitle[] = [];
    for (const list of lists) {
        for (const title of list) {
            const key = `${title.kind}:${title.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                titles.push(title);
            }
        }
    }
    return titles;
}

/** The titles grouped into shows, each group in the titles' order. */
export function groupVersions(
    titles: readonly PlatformTitle[]
): PlatformTitle[][] {
    const parent = titles.map((_, index) => index);
    const tmdb = titles.map((title) => title.tmdb);
    const year = titles.map((title) => title.year);
    const find = (index: number): number => {
        let root = index;
        while (parent[root] !== root) {
            root = parent[root];
        }
        parent[index] = root;
        return root;
    };
    /** Joins two entries' shows, unless their TMDB ids or years differ. */
    const join = (a: number, b: number, checkYear: boolean): boolean => {
        const [ra, rb] = [find(a), find(b)];
        if (ra === rb) {
            return true;
        }
        if (
            disagree(tmdb[ra], tmdb[rb], 0) ||
            (checkYear && disagree(year[ra], year[rb], YEAR_TOLERANCE))
        ) {
            return false;
        }
        parent[rb] = ra;
        tmdb[ra] = tmdb[ra] ?? tmdb[rb];
        year[ra] = year[ra] ?? year[rb];
        return true;
    };
    /** Each entry joins the first earlier one of its key that agrees. */
    const joinEach = (
        keyOf: (title: PlatformTitle) => string | null,
        checkYear: boolean,
        maxSize = Infinity
    ) => {
        for (const members of bucket(titles, keyOf).values()) {
            if (members.length > maxSize) {
                continue;
            }
            members.forEach((member, index) =>
                members
                    .slice(0, index)
                    .some((earlier) => join(earlier, member, checkYear))
            );
        }
    };
    joinEach(
        (title) => (title.tmdb ? `${title.kind}:${title.tmdb}` : null),
        false
    );
    joinEach((title) => {
        const name = nameKey(title.title);
        return name ? `${title.kind}:${name}` : null;
    }, true);
    joinEach(posterKey, true, MAX_POSTER_SHARERS);

    const groups = new Map<number, PlatformTitle[]>();
    titles.forEach((title, index) => {
        const root = find(index);
        const group = groups.get(root);
        if (group) {
            group.push(title);
        } else {
            groups.set(root, [title]);
        }
    });
    return [...groups.values()];
}

/** One title of a show's versions: the preferred language's first. */
export function mergeVersions(
    group: readonly PlatformTitle[],
    preferred: PlatformLanguage = 'ES'
): PlatformTitle {
    const ordered = [...group].sort(
        (a, b) =>
            Number(b.language === preferred) -
                Number(a.language === preferred) ||
            Number(!!b.poster) - Number(!!a.poster) ||
            b.added - a.added
    );
    const shown = ordered[0];
    const first = <T>(read: (title: PlatformTitle) => T | null): T | null =>
        ordered.map(read).find((value) => value !== null) ?? null;
    const versions: PlatformTitleVersion[] = [];
    const genres = new Set(shown.genres);
    for (const title of ordered) {
        versions.push(...title.versions);
        title.genres.forEach((genre) => genres.add(genre));
    }
    return {
        ...shown,
        added: Math.max(...group.map((title) => title.added)),
        genres: [...genres],
        poster: first((title) => title.poster),
        rating: first((title) => title.rating),
        plot: first((title) => title.plot),
        backdrop: first((title) => title.backdrop),
        tmdb: first((title) => title.tmdb),
        year: first((title) => title.year),
        versions,
    };
}

function disagree(
    a: number | null,
    b: number | null,
    tolerance: number
): boolean {
    return a !== null && b !== null && Math.abs(a - b) > tolerance;
}

function bucket(
    titles: readonly PlatformTitle[],
    keyOf: (title: PlatformTitle) => string | null
): Map<string, number[]> {
    const buckets = new Map<string, number[]>();
    titles.forEach((title, index) => {
        const key = keyOf(title);
        const members = key ? buckets.get(key) : undefined;
        if (members) {
            members.push(index);
        } else if (key) {
            buckets.set(key, [index]);
        }
    });
    return buckets;
}

/** "Fauda" and "FAUDA", "Élite" and "ELITE": the same name. */
export function nameKey(title: string): string {
    return title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** The poster's address; a TMDB image by its file, whatever its size. */
function posterKey(title: PlatformTitle): string | null {
    const url = title.poster
        ?.trim()
        .replace(/^https?:\/\//i, '')
        .replace(/[?#].*$/, '');
    if (!url) {
        return null;
    }
    const tmdbFile = /image\.tmdb\.org\/t\/p\/[^/]+\/(.+)$/i.exec(url);
    return `${title.kind}:${tmdbFile ? tmdbFile[1] : url}`;
}
