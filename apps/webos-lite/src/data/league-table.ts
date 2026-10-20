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
 * session; a league ESPN does not cover has no table.
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

const tables = new Map<string, Promise<LeagueTable | null>>();

export function hasTable(sectionId: SportSectionId): boolean {
    return !!SLUGS[sectionId];
}

export function leagueTable(sectionId: SportSectionId): Promise<LeagueTable | null> {
    const slug = SLUGS[sectionId];
    if (!slug) {
        return Promise.resolve(null);
    }
    let table = tables.get(slug);
    if (!table) {
        table = getJson(`${ESPN}${slug}/standings`, 15000).then(
            (body) => parseEspnTable(body, isFollowedTeam),
            () => {
                tables.delete(slug);
                return null;
            }
        );
        tables.set(slug, table);
    }
    return table;
}
