import type { PlatformTitleList } from '../catalog/catalog-titles';
import {
    foldTerm,
    matchRank,
    type TitleHit,
    type TitleKind,
} from './search-results';

/**
 * Buscar's titles from the platforms' own lists (`CatalogPlatformLists`,
 * kept across launches): a show the stored catalog lacks ("The Boys",
 * "Reacher", "The Last of Us" on Prime Video or HBO Max) is found too, and
 * named with its platform. Every word of the term must match the title or
 * one of its versions' names; the same folding and ranks as the stored
 * catalog's answers (`toTitleHits`).
 */
export function listTitleHits(
    lists: readonly PlatformTitleList[],
    kind: TitleKind,
    term: string
): TitleHit[] {
    if (!term) {
        return [];
    }
    const hits = new Map<string, TitleHit>();
    for (const list of lists) {
        for (const title of list.titles) {
            if (title.kind !== kind) {
                continue;
            }
            const key = `${kind}:${foldTerm(title.title)}`;
            const ranks = [title, ...title.versions]
                .map((version) => matchRank(version.title, term))
                .filter((rank) => rank >= 0);
            if (ranks.length === 0 || hits.has(key)) {
                continue;
            }
            hits.set(key, {
                key,
                kind,
                title: title.title,
                year: title.year,
                platform: list.platform.name,
                poster: title.poster,
                categoryId: title.categoryId,
                xtreamId: title.id,
                rank: Math.min(...ranks),
            });
        }
    }
    return byRank([...hits.values()]);
}

/**
 * The stored catalog's answers and the lists' together, one per title: a
 * stored answer the lists also found takes their platform (and poster)
 * where it names none.
 */
export function mergeTitleHits(
    stored: readonly TitleHit[],
    listed: readonly TitleHit[]
): TitleHit[] {
    const fromLists = new Map(listed.map((hit) => [hit.key, hit]));
    const merged = stored.map((hit) => {
        const twin = fromLists.get(hit.key);
        fromLists.delete(hit.key);
        return twin && (!hit.platform || !hit.poster)
            ? {
                  ...hit,
                  platform: hit.platform ?? twin.platform,
                  poster: hit.poster ?? twin.poster,
              }
            : hit;
    });
    return byRank([...merged, ...fromLists.values()]);
}

/** Best rank first; in their order on a tie. */
function byRank(hits: readonly TitleHit[]): TitleHit[] {
    return hits
        .map((hit, order) => ({ hit, order }))
        .sort((a, b) => a.hit.rank - b.hit.rank || a.order - b.order)
        .map(({ hit }) => hit);
}
