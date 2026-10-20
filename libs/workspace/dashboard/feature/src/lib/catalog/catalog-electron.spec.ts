import { toPlatformTitles } from '../platforms/platform-titles';
import {
    storedPlatformLists,
    toStoredVodCatalog,
    withKnownGenres,
    type StoredVodRow,
} from './catalog-stored-rows';
import {
    aggregateCatalog,
    buildCatalogRows,
    pickNewReleases,
    type CatalogTitle,
} from './catalog-titles';

/**
 * Series / Películas in the macOS app, from the catalog the app stored in
 * SQLite: the DB worker's rows carry the content's id, title, poster,
 * rating, `added` and the category's *row* id — no genre, year, TMDB id or
 * synopsis. Netflix is the biggest platform and the most recently updated
 * one, and the only one whose page was opened (so the only one whose
 * genres are known): "always Netflix" on the hero and in every row.
 */
const T0 = 1_760_000_000;

const dbCategory = (id: number, xtreamId: number, name: string) => ({
    id,
    name,
    playlist_id: 'p1',
    type: 'series' as const,
    xtream_id: xtreamId,
    hidden: false,
    locked: false,
});

const CATEGORIES = [
    dbCategory(601, 2331, '|ES| ✪ NETFLIX SERIES'),
    dbCategory(602, 482, '|EN| ✪ NETFLIX'),
    dbCategory(603, 2330, '|ES| ✪ HBO-MAX'),
    dbCategory(604, 1270, '|EN| ✪ AMAZON-PRIME'),
    dbCategory(605, 1720, '|ES| ✪ DISNEY+'),
    dbCategory(606, 9001, '|FR| ✪ NETFLIX'),
];

let nextId = 1000;
/** A DB worker row (`selectContentFields`), as `getCachedContent` sends it. */
function sqliteRow(
    categoryRowId: number,
    title: string,
    ageMinutes: number | null,
    poster = `http://img/${nextId}.jpg`
): StoredVodRow {
    const id = nextId++;
    return {
        id: id + 50_000,
        category_id: categoryRowId,
        title,
        rating: '7.5',
        added: ageMinutes === null ? '' : String(T0 - ageMinutes * 60),
        poster_url: poster,
        epg_channel_id: null,
        tv_archive: null,
        tv_archive_duration: null,
        direct_source: null,
        xtream_id: id,
        type: 'series',
    } as StoredVodRow;
}

const NETFLIX_SHOWS = [
    ['MIÉRCOLES', 'WEDNESDAY', 2022],
    ['LA CASA DE PAPEL', 'MONEY HEIST', 2017],
    ['STRANGER THINGS', 'STRANGER THINGS', 2016],
    ['DARK', 'DARK', 2017],
    ['ÉLITE', 'ELITE', 2018],
    ['BRIDGERTON', 'BRIDGERTON', 2020],
    ['OZARK', 'OZARK', 2017],
    ['NARCOS', 'NARCOS', 2015],
    ['LUPIN', 'LUPIN', 2021],
    ['YOU', 'YOU', 2018],
] as const;

/** Netflix: Spanish and English versions (one poster), newest of all. */
function storedRows(dated: boolean): StoredVodRow[] {
    const age = (minutes: number) => (dated ? minutes : null);
    const rows: StoredVodRow[] = [];
    NETFLIX_SHOWS.forEach(([es, en, year], index) => {
        const poster = `http://img/netflix-${index}.jpg`;
        rows.push(sqliteRow(601, `${es} (${year}) ES`, age(index), poster));
        rows.push(sqliteRow(602, `${en} (${year})_ENG`, age(index), poster));
    });
    rows.push(sqliteRow(602, 'THE OFFICE (2005)_ENG', age(30)));
    ['LA CASA DEL DRAGÓN', 'SUCCESSION', 'EL PINGÜINO', 'EUPHORIA'].forEach(
        (name, index) => rows.push(sqliteRow(603, name, age(600 + index)))
    );
    ['THE BOYS', 'REACHER', 'FALLOUT', 'THE OFFICE (2005)'].forEach(
        (name, index) => rows.push(sqliteRow(604, name, age(900 + index)))
    );
    ['THE BEAR', 'ANDOR', 'SHŌGUN'].forEach((name, index) =>
        rows.push(sqliteRow(605, name, age(1200 + index)))
    );
    rows.push(sqliteRow(606, 'MERCREDI', age(0)));
    return rows;
}

/** What the Netflix page loaded (the panel's lists name genres). */
function netflixPageTitles(rows: readonly StoredVodRow[]) {
    return toPlatformTitles(
        { id: '2331', kind: 'series', language: 'ES' },
        rows
            .filter((row) => row.category_id === 601)
            .map((row, index) => ({
                series_id: row.xtream_id,
                name: row.title,
                genre: ['Drama', 'Comedia', 'Crimen, Drama'][index % 3],
            }))
    );
}

function storedCatalog(dated = true): CatalogTitle[] {
    const rows = storedRows(dated);
    const lists = withKnownGenres(
        storedPlatformLists(
            toStoredVodCatalog(CATEGORIES, rows, true),
            'series'
        ),
        (list) =>
            list.platform.id === 'netflix' ? netflixPageTitles(rows) : null
    );
    return aggregateCatalog(lists, 'series');
}

const platformsIn = (titles: readonly CatalogTitle[]) =>
    new Set(titles.map((title) => title.platform.id));

describe("the stored catalog in Electron (the DB worker's rows)", () => {
    it('lets the platforms take turns, the newest platform first', () => {
        const titles = storedCatalog();

        // One title per show: Netflix's ES and EN versions together.
        expect(titles).toHaveLength(10 + 4 + 4 + 3);
        expect(titles.slice(0, 4).map((title) => title.platform.id)).toEqual(
            ['netflix', 'prime-video', 'hbo-max', 'disney-plus']
        );
        expect(titles[0]).toMatchObject({
            title: 'MIÉRCOLES',
            language: 'ES',
            added: T0,
        });
        expect(titles[0].versions.map((version) => version.language)).toEqual(
            ['ES', 'EN']
        );
    });

    it('takes turns too where the rows carry no dates', () => {
        const titles = storedCatalog(false);

        expect(platformsIn(titles.slice(0, 4)).size).toBe(4);
        expect(titles.every((title) => title.added === 0)).toBe(true);
    });

    it('fills no row with the one platform whose genres are known', () => {
        const rows = buildCatalogRows(storedCatalog());

        // Only Netflix names genres: a row per platform, every platform.
        expect(rows.map((row) => row.id)).toEqual([
            'netflix',
            'prime-video',
            'hbo-max',
            'disney-plus',
        ]);
        for (const row of rows) {
            expect([...platformsIn(row.titles)]).toEqual([row.platform?.id]);
        }
    });

    it('mixes the genre rows once two platforms name genres', () => {
        const titles = storedCatalog().map((title) =>
            title.platform.id === 'hbo-max'
                ? { ...title, genres: ['drama' as const] }
                : title
        );

        const rows = buildCatalogRows(titles);

        const drama = rows.find((row) => row.genre === 'drama');
        expect(platformsIn(drama?.titles ?? [])).toEqual(
            new Set(['netflix', 'hbo-max'])
        );
        expect(drama?.titles.slice(0, 2).map((title) => title.platform.id))
            .toEqual(['netflix', 'hbo-max']);
        // The platforms that name none keep a row of their own.
        expect(
            rows.filter((row) => row.platform).map((row) => row.id)
        ).toEqual(['prime-video', 'disney-plus']);
    });

    it('features another platform from one session to the next', () => {
        const titles = storedCatalog();

        const heroes = [0, 1, 2, 3].map(
            (lead) => pickNewReleases(titles, 10, lead)[0].platform.id
        );

        expect(heroes).toEqual([
            'netflix',
            'prime-video',
            'hbo-max',
            'disney-plus',
        ]);
        expect(platformsIn(pickNewReleases(titles, 4, 2)).size).toBe(4);
    });

    it('credits a show both carry to the platform with fewer titles', () => {
        const office = storedCatalog().find(
            (title) => title.title === 'THE OFFICE'
        );

        expect(office?.platform.id).toBe('prime-video');
        expect(office?.platforms.map((platform) => platform.id)).toEqual([
            'prime-video',
            'netflix',
        ]);
        // It opens Prime Video's entry.
        expect(office?.categoryId).toBe('1270');
        expect(office?.versions[0].categoryId).toBe('1270');
        expect(office?.versions).toHaveLength(2);
    });
});
