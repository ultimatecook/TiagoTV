import type {
    PlaylistMeta,
    PortalAddedItem,
} from '@iptvnator/shared/interfaces';
import { pickNewReleases, type CatalogTitle } from '../catalog/catalog-titles';

/** Of each kind: more than the hero's places, for the ones already shown. */
const HERO_CATALOG_TITLES = 6;

/**
 * The Home hero's discovery slides ("Recién agregado"), from Series /
 * Películas' catalog (`CatalogService`): one title per show, in Spanish
 * where it has a Spanish version, the platforms taking turns
 * (`pickNewReleases`, led by the session's `lead`), movies and series in
 * turn. The provider's raw newest rows would feature one platform's batch
 * of uploads, in English beside the Spanish title the rows below show.
 */
export function catalogHeroItems(
    movies: readonly CatalogTitle[] | null,
    series: readonly CatalogTitle[] | null,
    playlist: PlaylistMeta | null,
    lead: number
): PortalAddedItem[] {
    if (!playlist) {
        return [];
    }
    const lists = [movies, series].map((titles) =>
        pickNewReleases(titles ?? [], HERO_CATALOG_TITLES, lead)
    );
    const items: PortalAddedItem[] = [];
    for (let index = 0; index < HERO_CATALOG_TITLES; index++) {
        for (const list of lists) {
            const title = list[index];
            if (title) {
                items.push(toAddedItem(title, playlist));
            }
        }
    }
    return items;
}

function toAddedItem(
    title: CatalogTitle,
    playlist: PlaylistMeta
): PortalAddedItem {
    return {
        id: title.id,
        title: title.title,
        type: title.kind,
        playlist_id: playlist._id,
        playlist_name: playlist.title,
        added_at: new Date(title.added * 1000).toISOString(),
        category_id: title.categoryId,
        xtream_id: title.id,
        source: 'xtream',
        ...(title.poster ? { poster_url: title.poster } : {}),
        ...(title.backdrop ? { backdrop_url: title.backdrop } : {}),
        ...(title.tmdb ? { tmdb_id: title.tmdb } : {}),
        ...(title.year ? { release_year: title.year } : {}),
        ...(title.rating !== null ? { rating: String(title.rating) } : {}),
        ...(title.plot ? { plot: title.plot } : {}),
    };
}
