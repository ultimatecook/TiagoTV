import {
    seriesBadge,
    type CatalogTitle,
    type HomeSeriesBadge,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { clear, h, picture } from '../core/dom';
import { onActivate } from '../core/nav';
import { tmdbSized } from '../data/images';
import { myList } from '../data/my-list';
import { t } from '../data/strings';
import { genreLabel } from '../data/title-meta';
import { platformMark } from './cards';
import { hueOf } from './colour';
import { icon } from './icons';

/**
 * "Series para ti" (the desktop's editorial block): a large card with the
 * featured series (its backdrop, platform, badge, title, meta, synopsis,
 * "Empezar T1 · E1" and "Mi lista"), two smaller ones stacked beside it.
 */
export interface SeriesForYouActions {
    readonly open: (title: CatalogTitle) => void;
    readonly start: (title: CatalogTitle) => void;
}

function badge(value: HomeSeriesBadge | null): HTMLElement | null {
    if (!value) {
        return null;
    }
    const text =
        value.kind === 'season'
            ? t('WORKSPACE.DASHBOARD.BADGE_SEASON', { season: value.season ?? 2 })
            : value.kind === 'premiere'
              ? t('WORKSPACE.DASHBOARD.BADGE_PREMIERE')
              : t('WORKSPACE.DASHBOARD.BADGE_NEW_EPISODE');
    return h('span', { className: `sfy__badge sfy__badge--${value.kind}`, text });
}

function art(title: CatalogTitle, className: string): HTMLElement {
    const box = h('div', className);
    box.style.background = `radial-gradient(90% 110% at 72% 30%, hsl(${hueOf(title.title)},30%,30%) 0%, #0b0b0a 85%)`;
    const image = title.backdrop ? tmdbSized(title.backdrop, 'w780') : tmdbSized(title.poster, 'w342');
    box.appendChild(picture(image, `sfy__pic${title.backdrop ? '' : ' is-poster'}`, ''));
    box.appendChild(h('div', 'sfy__veil'));
    return box;
}

function meta(title: CatalogTitle): string {
    const parts: string[] = [];
    if (title.year) {
        parts.push(String(title.year));
    }
    if (title.genres.length > 0) {
        parts.push(title.genres.slice(0, 2).map(genreLabel).join(', '));
    }
    return parts.join(' · ');
}

function listLabel(title: CatalogTitle): string {
    return myList.has('series', title.id) ? '✓ Mi lista' : t('WORKSPACE.DASHBOARD.MY_LIST');
}

export function seriesForYou(titles: readonly CatalogTitle[], actions: SeriesForYouActions): HTMLElement {
    const block = h('div', 'sfy');
    const [featured, ...side] = titles;
    if (!featured) {
        return block;
    }
    const start = onActivate(
        h('div', 'button button--primary', icon('play'), t('WORKSPACE.DASHBOARD.START_FIRST_EPISODE')),
        () => actions.start(featured)
    );
    const list = h('div', { className: 'button', text: listLabel(featured) });
    onActivate(list, () => {
        myList.toggle({ kind: 'series', id: featured.id, title: featured.title, image: featured.poster, categoryId: featured.categoryId });
        clear(list);
        list.appendChild(document.createTextNode(listLabel(featured)));
    });
    block.appendChild(
        h(
            'div',
            'sfy__featured',
            art(featured, 'sfy__art'),
            h(
                'div',
                'sfy__content',
                h('div', 'sfy__brand', platformMark(featured.platform, 'sfy__mark'), badge(seriesBadge(featured))),
                h('h3', { className: 'sfy__title display', text: featured.title }),
                h('div', { className: 'sfy__meta', text: meta(featured) }),
                featured.plot ? h('p', { className: 'sfy__plot', text: featured.plot }) : null,
                h('div', 'sfy__actions', start, list)
            )
        )
    );
    const column = h('div', 'sfy__side');
    for (const title of side) {
        column.appendChild(
            onActivate(
                h(
                    'div',
                    'sfy__card',
                    art(title, 'sfy__art'),
                    h(
                        'div',
                        'sfy__content',
                        h('div', 'sfy__brand', platformMark(title.platform, 'sfy__mark'), badge(seriesBadge(title))),
                        h('h3', { className: 'sfy__title display', text: title.title }),
                        title.plot ? h('p', { className: 'sfy__plot', text: title.plot }) : null
                    )
                ),
                () => actions.open(title)
            )
        );
    }
    block.appendChild(column);
    return block;
}
