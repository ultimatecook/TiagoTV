import {
    languageVersions,
    type CatalogTitle,
    type PlatformLook,
    type PlatformTitle,
    type StreamingPlatform,
    type TileDress,
} from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h, picture } from '../core/dom';
import { durationLabel } from '../core/format';
import type { Episode, SeriesDetails, TitleDetails } from '../data/details';
import { tmdbSized } from '../data/images';
import { resume } from '../data/resume';
import { t } from '../data/strings';
import { genreLabel, posterMeta } from '../data/title-meta';
import type { App } from '../app';
import { CARD, posterCard } from '../ui/cards';
import { platformTile } from '../ui/platform-cards';
import { Row } from '../ui/row';

/**
 * The title page's pieces: its meta line, season chips, episode rows and
 * "Más títulos" (the platform's other titles of the same kind).
 */
const MORE_TITLES = 20;

/** "2021  Drama · Acción  ★ 8.0  1 h 32 min  ES EN". */
export function detailMeta(title: PlatformTitle, details: TitleDetails | null): HTMLElement[] {
    const parts: HTMLElement[] = [];
    const year = details?.year ?? title.year;
    if (year) {
        parts.push(h('span', { text: String(year) }));
    }
    const genres = title.genres.length > 0 ? title.genres.slice(0, 2).map(genreLabel).join(' · ') : details?.genre ?? '';
    if (genres) {
        parts.push(h('span', { text: genres }));
    }
    const rating = details?.rating ?? title.rating;
    if (rating) {
        parts.push(h('span', { className: 'detail__rating', text: `★ ${rating.toFixed(1)}` }));
    }
    const series = details as SeriesDetails | null;
    if (series && series.seasons) {
        const count = series.seasons.length;
        if (count > 0) {
            parts.push(h('span', { text: count === 1 ? t('WORKSPACE.CATALOG.SEASON_ONE') : t('WORKSPACE.CATALOG.SEASONS', { count }) }));
        }
    } else if (details && details.durationSeconds > 0) {
        parts.push(h('span', { text: durationLabel(details.durationSeconds) }));
    }
    for (const version of languageVersions(title)) {
        parts.push(h('span', { className: 'detail__lang', text: version.language }));
    }
    return parts;
}

export function seasonChip(season: number, selected: boolean): HTMLElement {
    return h('div', {
        className: `chip${selected ? ' is-selected' : ''}`,
        text: season > 0 ? t('PORTALS.SEASON_TAB', { number: season }) : 'Especiales',
    });
}

export function episodeRow(episode: Episode): HTMLElement {
    const entry = resume.get('episode', episode.id);
    const progress = entry && entry.duration > 0 ? Math.min(1, entry.position / entry.duration) : 0;
    const bar = progress > 0 ? h('span', 'episode__progress', h('i')) : null;
    if (bar) {
        (bar.firstChild as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
    }
    return h(
        'div',
        'episode',
        h('span', { className: 'episode__number', text: String(episode.number) }),
        episode.image ? picture(tmdbSized(episode.image, 'w185'), 'episode__still', '') : null,
        h(
            'span',
            'episode__text',
            h('span', { className: 'episode__title', text: episode.title }),
            episode.plot ? h('span', { className: 'episode__plot', text: episode.plot }) : null
        ),
        h('span', { className: 'episode__length', text: durationLabel(episode.durationSeconds) }),
        bar
    );
}

/** The desktop's similar-titles cards: posters, in the look's corners. */
const SIMILAR: TileDress = { tile: 'poster', large: false, caption: false, sub: false, info: false };

/** "Más títulos": the platform's newest of the same kind, not this one, in the platform's tiles. */
export function moreTitlesRow(app: App, title: PlatformTitle, platform: StreamingPlatform | null, look: PlatformLook): Row<PlatformTitle> | null {
    const pool: PlatformTitle[] = platform
        ? app.store.platformTitles(platform.id)
        : (app.store.titles(title.kind) as CatalogTitle[]);
    const titles = pool.filter((other) => other.kind === title.kind && other.id !== title.id).slice(0, MORE_TITLES);
    if (titles.length < 2) {
        return null;
    }
    const row = new Row<PlatformTitle>({
        title: 'Más títulos',
        variant: look === 'default' ? 'posters' : 'tiles-poster',
        cardWidth: CARD.poster.width,
        gap: CARD.poster.gap,
        render: (other) => {
            const owner = (other as CatalogTitle).platform ?? platform;
            return look === 'default'
                ? posterCard({ title: other, platform: owner, meta: posterMeta(other) })
                : platformTile({ title: other, platform: owner }, SIMILAR, look);
        },
        activate: (other) => app.openTitle(other),
    });
    row.setItems(titles);
    return row;
}
