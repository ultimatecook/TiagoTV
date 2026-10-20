import type { HomeEventRow } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clockTime } from '../core/format';
import { h } from '../core/dom';
import { onActivate } from '../core/nav';
import { assetUrl } from '../data/images';
import { icon } from './icons';

/**
 * "Eventos de hoy" and "Más tarde": today's matches in one card, a row
 * each: on now (red dot) or the kick-off, the competition's logo and
 * name, both sides (the viewer's teams in bold), the channel and a play
 * circle. OK plays the match's channel.
 */
export function eventRow(row: HomeEventRow, play: () => void): HTMLElement {
    const status = row.live
        ? h('span', 'event__status is-live', h('i', 'dot dot--red'), 'EN VIVO')
        : h('span', { className: 'event__status', text: row.kickOff ? clockTime(row.kickOff) : 'Hoy' });
    const logo = assetUrl(row.logo);
    const badge = h('span', 'event__badge', logo ? h('img', { attrs: { src: logo, alt: '' } }) : null);
    badge.style.background = row.tint;
    const sides =
        row.home && row.away
            ? [
                  h('span', { className: `event__home${row.homeMine ? ' is-mine' : ''}`, text: row.home }),
                  h('span', { className: 'event__vs', text: 'vs' }),
                  h('span', { className: `event__away${row.awayMine ? ' is-mine' : ''}`, text: row.away }),
              ]
            : [h('span', { className: 'event__title', text: row.title })];
    const el = h(
        'div',
        'event',
        status,
        h('span', 'event__competition', badge, h('span', { text: row.competition })),
        h('span', 'event__sides', ...sides),
        h('span', { className: 'event__channel', text: row.channel }),
        h('span', 'event__play', icon('play'))
    );
    return onActivate(el, play);
}

export function eventsList(rows: readonly HomeEventRow[], play: (row: HomeEventRow) => void): HTMLElement {
    const list = h('div', 'events');
    for (const row of rows) {
        list.appendChild(eventRow(row, () => play(row)));
    }
    return list;
}
