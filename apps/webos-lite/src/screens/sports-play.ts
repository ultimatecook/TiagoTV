import type { SportMatch } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { matchChannel, matchSides, matchStreamId } from '../data/sports';
import type { App, PlayItem } from '../app';

/**
 * A match plays its channel, full screen, with the others of the list it
 * was picked from a CH+/CH- away.
 */
export function matchItem(match: SportMatch): PlayItem | null {
    const id = matchStreamId(match);
    if (id === null) {
        return null;
    }
    const { home, away } = matchSides(match);
    return {
        kind: 'live',
        id,
        title: home && away ? `${home} - ${away}` : match.event.title,
        subtitle: `${match.event.competition} · ${matchChannel(match)}`,
        logo: match.icon,
    };
}

export function playMatches(app: App, matches: readonly SportMatch[], picked: SportMatch): void {
    const items: PlayItem[] = [];
    let index = 0;
    for (const match of matches) {
        const item = matchItem(match);
        if (!item) {
            continue;
        }
        if (match === picked) {
            index = items.length;
        }
        items.push(item);
    }
    if (items.length > 0) {
        app.play({ items, index });
    }
}
