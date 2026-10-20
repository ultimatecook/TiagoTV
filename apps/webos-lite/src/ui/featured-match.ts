import type { SportMatch, SportSection } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clockTime } from '../core/format';
import { h } from '../core/dom';
import { isLive, matchChannel, matchSides } from '../data/sports';
import { t } from '../data/strings';
import { tint } from './colour';
import { icon } from './icons';
import { crest } from './match-cards';

/**
 * A league page's featured match (its first, on now or next): the full
 * width card on the competition's colour, both sides with their crests,
 * the state ("En vivo" or the kick-off), VS and "Ver en {canal}".
 */
export function featuredMatch(match: SportMatch, section: SportSection | null, now = new Date()): HTMLElement {
    const { home, away } = matchSides(match);
    const live = isLive(match, now);
    const status = live
        ? h('span', 'featured__status', h('i', 'dot'), t('WORKSPACE.SPORTS.LIVE'))
        : h('span', 'featured__status', h('i', 'dot dot--amber'), match.event.start ? clockTime(match.event.start) : t('WORKSPACE.SPORTS.DAYS.TODAY'));
    const card = h(
        'div',
        'featured',
        h('div', 'featured__side featured__side--home', h('span', { className: 'featured__name', text: home ?? match.event.title }), home ? crest(home, 'crest crest--large') : null),
        h(
            'div',
            'featured__middle',
            status,
            h('div', { className: 'featured__vs display', text: 'VS' }),
            h('div', 'featured__watch', icon('play'), t('WORKSPACE.SPORTS.WATCH_ON', { channels: matchChannel(match) }))
        ),
        h('div', 'featured__side featured__side--away', away ? crest(away, 'crest crest--large') : null, h('span', { className: 'featured__name', text: away ?? '' }))
    );
    const color = section ? section.tint : '#2a2a2a';
    card.style.background = `linear-gradient(120deg, ${tint(color, '#000000', 0.05, 0.96)} 0%, ${tint(color, '#000000', 0.55, 0.96)} 60%, ${tint(color, '#000000', 0.8, 0.96)} 100%)`;
    return card;
}
