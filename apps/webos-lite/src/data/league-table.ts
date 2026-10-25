import {
    parseEspnTable,
    isFollowedTeam,
    type LeagueTable,
    type SportSectionId,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { getJson } from '../core/http';

/**
 * A league page's standings, as the desktop's: ESPN's public site API
 * (no key, CORS-enabled), parsed by the desktop's parseEspnTable, the
 * viewer's teams preferred where the table is in groups. Kept for the
 * session (a failure for a couple of minutes); a league ESPN does not
 * cover has no table. The crests read their logos too (data/crests.ts).
 */
const ESPN = 'https://site.api.espn.com/apis/v2/sports/soccer/';

/** The ESPN slugs of the desktop's league-tables.ts. */
const SLUGS: Partial<Record<SportSectionId, string>> = {
    laliga: 'esp.1',
    'premier-league': 'eng.1',
    'liga-argentina': 'arg.1',
    'champions-league': 'uefa.champions',
    'europa-league': 'uefa.europa',
    libertadores: 'conmebol.libertadores',
    mls: 'usa.1',
    hypermotion: 'esp.2',
    'serie-a': 'ita.1',
    bundesliga: 'ger.1',
    'ligue-1': 'fra.1',
    eredivisie: 'ned.1',
};

/** A table ESPN failed to give is not asked again for this long. */
const RETRY_MS = 2 * 60 * 1000;

const tables = new Map<string, Promise<LeagueTable | null>>();
const failedAt = new Map<string, number>();

export function hasTable(sectionId: SportSectionId): boolean {
    return !!SLUGS[sectionId];
}

export function leagueTable(sectionId: SportSectionId): Promise<LeagueTable | null> {
    const slug = SLUGS[sectionId];
    if (!slug) {
        return Promise.resolve(null);
    }
    let table = tables.get(slug);
    const failed = failedAt.get(slug);
    if (!table || (failed !== undefined && Date.now() - failed > RETRY_MS)) {
        failedAt.delete(slug);
        table = getJson(`${ESPN}${slug}/standings`, 15000).then(
            (body) => parseEspnTable(body, isFollowedTeam),
            () => {
                // The crests ask for many teams at once: one failure answers them all.
                failedAt.set(slug, Date.now());
                return null;
            }
        );
        tables.set(slug, table);
    }
    return table;
}
