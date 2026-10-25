import type { PlatformTitle } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { h } from '../core/dom';
import { nav, onActivate } from '../core/nav';
import { myList, type ListEntry } from '../data/my-list';
import { t } from '../data/strings';
import type { App } from '../app';
import { CARD, posterCard } from '../ui/cards';
import { icon } from '../ui/icons';
import { Row } from '../ui/row';
import { VPage } from '../ui/vpage';
import type { Page } from './shell';

/**
 * Mi lista: the movies and series the viewer kept on this TV (the heart
 * on a title's page, "Mi lista" in "Series para ti"), a row of each; empty,
 * the desktop's heart and its words, and the way back to Inicio.
 */
function asTitle(entry: ListEntry): PlatformTitle {
    const kind = entry.kind === 'movie' ? 'movie' : 'series';
    return {
        id: entry.id,
        kind,
        categoryId: entry.categoryId ?? '',
        title: entry.title,
        poster: entry.image,
        language: 'ES',
        added: entry.addedAt / 1000,
        genres: [],
        rating: null,
        plot: null,
        backdrop: null,
        tmdb: null,
        year: null,
        versions: [{ id: entry.id, categoryId: entry.categoryId ?? '', language: 'ES', title: entry.title }],
    };
}

export class MyListPage implements Page {
    private readonly page = new VPage('page page--mylist', 130);
    private readonly movies: Row<PlatformTitle>;
    private readonly series: Row<PlatformTitle>;
    private readonly empty: HTMLElement;

    constructor(private readonly app: App) {
        const row = (title: string) =>
            new Row<PlatformTitle>({
                title,
                variant: 'posters',
                cardWidth: CARD.poster.width,
                gap: CARD.poster.gap,
                render: (item) => posterCard({ title: item, platform: app.store.platformOf(item) }),
                activate: (item) => app.openTitle(item),
            });
        this.movies = row(t('WORKSPACE.CATALOG.MOVIES'));
        this.series = row(t('WORKSPACE.CATALOG.SERIES'));
        this.empty = h(
            'div',
            'empty',
            icon('heart', 'empty__icon'),
            h('h2', { className: 'empty__title', text: t('WORKSPACE.GLOBAL_FAVORITES.NO_ITEMS_TITLE') }),
            h('p', { className: 'empty__text', text: t('WORKSPACE.GLOBAL_FAVORITES.NO_ITEMS_BODY') }),
            onActivate(h('div', { className: 'button', text: 'Volver al inicio' }), () => app.openTab('home'))
        );
        this.page.add(h('div', 'page__head', h('h1', { className: 'page__title', text: t('WORKSPACE.GLOBAL_FAVORITES.TITLE') })));
        this.page.add(this.series);
        this.page.add(this.movies);
        this.page.add(this.empty);
    }

    get el(): HTMLElement {
        return this.page.el;
    }

    focusTarget(): HTMLElement | null {
        return nav.first(this.page.el);
    }

    show(): void {
        const entries = myList.all();
        const movies = entries.filter((entry) => entry.kind === 'movie').map(asTitle);
        const series = entries.filter((entry) => entry.kind === 'series').map(asTitle);
        this.movies.el.style.display = movies.length > 0 ? '' : 'none';
        this.series.el.style.display = series.length > 0 ? '' : 'none';
        this.empty.style.display = entries.length > 0 ? 'none' : '';
        this.movies.setItems(movies, true);
        this.series.setItems(series, true);
        this.page.updateNear();
    }

    hide(): void {
        // Nothing runs here.
    }
}
