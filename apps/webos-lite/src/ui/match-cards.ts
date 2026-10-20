import {
    competitionLogo,
    findSportSection,
    type SportMatch,
    type SportSectionId,
    type TeamFixture,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clockTime } from '../core/format';
import { h } from '../core/dom';
import { assetUrl } from '../data/images';
import { isLive, matchChannel, matchSides } from '../data/sports';
import { t } from '../data/strings';
import { tint } from './colour';
import { crest } from './crest';
import { icon } from './icons';

/**
 * The sports hub's cards, as the desktop's: a team's crest (ui/crest.ts),
 * "Tus equipos" pills, and the "En vivo ahora" cards on the competition's
 * colour.
 */
/** "Hoy · 19:00", "En vivo", or nothing for a team without a match. */
function fixtureStatus(fixture: TeamFixture, now: Date): string {
    const match = fixture.match;
    if (!match) {
        return '';
    }
    if (isLive(match, now)) {
        return t('WORKSPACE.SPORTS.LIVE');
    }
    return match.event.start ? `${t('WORKSPACE.SPORTS.DAYS.TODAY')} · ${clockTime(match.event.start)}` : t('WORKSPACE.SPORTS.DAYS.TODAY');
}

export function teamPill(fixture: TeamFixture, now = new Date()): HTMLElement {
    const status = fixtureStatus(fixture, now);
    return h(
        'div',
        'team-pill',
        crest(fixture.team.name, 'crest crest--small', fixture.team.sectionId),
        h('span', { className: 'team-pill__name', text: fixture.team.name }),
        status ? h('span', { className: `team-pill__status${fixture.match && isLive(fixture.match, now) ? ' is-live' : ''}`, text: status }) : null
    );
}

function side(name: string, section: SportSectionId): HTMLElement {
    return h('div', 'match__side', crest(name, 'crest', section), h('div', { className: 'match__name', text: name }));
}

/** "En vivo ahora": the competition, both sides, "Ver en {canal}". */
export function liveMatchCard(match: SportMatch, now = new Date()): HTMLElement {
    const section = findSportSection(match.sectionId);
    const logo = assetUrl(competitionLogo(section, match.event.competition));
    const { home, away } = matchSides(match);
    const live = isLive(match, now);
    const card = h(
        'div',
        'match-card',
        h(
            'div',
            'match-card__top',
            logo ? h('img', { className: 'match-card__logo', attrs: { src: logo, alt: '' } }) : null,
            h('span', { className: 'match-card__competition', text: (section && !section.catchAll ? section.title : match.event.competition).toUpperCase() }),
            h('span', {
                className: `match-card__status${live ? ' is-live' : ''}`,
                text: live ? t('WORKSPACE.SPORTS.LIVE') : match.event.start ? clockTime(match.event.start) : '',
            })
        ),
        home && away
            ? h('div', 'match-card__sides', side(home, match.sectionId), h('div', { className: 'match-card__vs display', text: 'VS' }), side(away, match.sectionId))
            : h('div', { className: 'match-card__title', text: match.event.title }),
        h('div', 'match-card__watch', icon('play'), t('WORKSPACE.SPORTS.WATCH_ON', { channels: matchChannel(match) }))
    );
    const color = section ? section.tint : '#2a2a2a';
    card.style.background = `linear-gradient(160deg, ${tint(color, '#000000', 0.1, 0.95)} 0%, ${tint(color, '#000000', 0.7, 0.95)} 100%)`;
    return card;
}
