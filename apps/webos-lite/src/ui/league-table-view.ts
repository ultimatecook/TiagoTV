import { isFollowedTeam, type LeagueTable, type SportSection } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h, picture } from '../core/dom';
import { onActivate } from '../core/nav';
import { assetUrl } from '../data/images';
import { t } from '../data/strings';
import { tint } from './colour';

/**
 * "Tabla de posiciones", as the desktop's: a header on the league's
 * colour, then a row per team (position, crest, name, played, points),
 * the zones as a bar on the left, the viewer's teams highlighted. Rows
 * take focus only so the remote can scroll through the table.
 */
export function tableView(table: LeagueTable, section: SportSection | null): HTMLElement {
    const logo = section ? assetUrl(section.logo) : null;
    const head = h(
        'div',
        'table__head',
        logo ? h('img', { className: 'table__logo', attrs: { src: logo, alt: '' } }) : null,
        h('span', 'table__title', t('WORKSPACE.SPORTS.TABLE'), table.round ? h('small', { text: `Jornada ${table.round}` }) : null)
    );
    if (section) {
        head.style.background = tint(section.tint, '#000000', 0.15, 0.95);
    }
    const columns = h(
        'div',
        'table__row table__row--labels',
        h('span', { className: 'table__rank', text: '#' }),
        h('span', { className: 'table__team', text: t('WORKSPACE.SPORTS.TABLE_TEAM').toUpperCase() }),
        h('span', { className: 'table__played', text: t('WORKSPACE.SPORTS.TABLE_PLAYED') }),
        h('span', { className: 'table__points', text: t('WORKSPACE.SPORTS.TABLE_POINTS').toUpperCase() })
    );
    const body = h('div', 'table', head, columns);
    for (const row of table.rows) {
        const el = h(
            'div',
            `table__row${row.zone ? ` zone--${row.zone}` : ''}${isFollowedTeam(row.team) ? ' is-mine' : ''}`,
            h('span', { className: `table__rank${row.rank <= 3 ? ' is-top' : ''}`, text: String(row.rank) }),
            h('span', 'table__team', row.badge ? picture(row.badge, 'table__badge', '') : h('span', 'table__badge'), row.team),
            h('span', { className: 'table__played', text: String(row.played) }),
            h('span', { className: 'table__points', text: String(row.points) })
        );
        body.appendChild(onActivate(el, () => undefined));
    }
    return body;
}
