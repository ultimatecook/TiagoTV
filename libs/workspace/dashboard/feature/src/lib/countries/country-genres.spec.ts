import {
    categoryTier,
    channelGenre,
    isGenericCategory,
} from './country-genres';

describe('categoryTier', () => {
    it.each([
        [null, 'main'],
        ['Entertainment', 'main'],
        ['Entretenimiento', 'main'],
        ['BBC General', 'main'],
        ['Deportes', 'sports'],
        ['DAZN La Liga', 'sports'],
        ['Liga Profesional', 'sports'],
        ['M+ Liga de Campeones', 'sports'],
        ['ViX / TUDN', 'sports'],
        ['NFL Teams', 'sports'],
        ['LaLiga+ PPV', 'events'],
        ['DAZN Event', 'events'],
        ['Gol Mundial Solo Eventos', 'events'],
        ['PDC Board', 'events'],
        ['News', 'news'],
        ['Cinema', 'movies'],
        ['Box Office 24/7', 'movies'],
        ['Movies Channels', 'movies'],
        ['Kids Network', 'kids'],
        ['Niños', 'kids'],
        ['Documentales', 'documentary'],
        ['Discovery+', 'documentary'],
        ['Music', 'music'],
        ['Local - NBC', 'more'],
        ['Autonómicos', 'more'],
        ['Rakuten TV', 'more'],
        ['4K', 'copies'],
        ['SD', 'copies'],
        ['Timeshift or +1', 'copies'],
    ])('files "%s" as %s', (label, tier) => {
        expect(categoryTier(label)).toBe(tier);
    });
});

describe('isGenericCategory', () => {
    it('tells a kind’s own category from a named one', () => {
        expect(isGenericCategory(null, 'main')).toBe(true);
        expect(isGenericCategory('Deportes', 'sports')).toBe(true);
        expect(isGenericCategory('Movies Channels', 'movies')).toBe(true);
        expect(isGenericCategory('Niños', 'kids')).toBe(true);
        expect(isGenericCategory('DAZN La Liga', 'sports')).toBe(false);
        expect(isGenericCategory('Box Office', 'movies')).toBe(false);
    });
});

describe('channelGenre', () => {
    it.each([
        ['ESPN 2', 'sports'],
        ['TyC Sports', 'sports'],
        ['FOX Sports 1', 'sports'],
        ['Teledeporte', 'sports'],
        ['C5N', 'news'],
        ['TN', 'news'],
        ['FOX News', 'news'],
        ['Canal 24 Horas', 'news'],
        ['Cartoon Network', 'kids'],
        ['Discovery Kids', 'kids'],
        ['Clan TVE', 'kids'],
        ['HBO 2', 'movies'],
        ['TNT Series', 'movies'],
        ['Calle 13', 'movies'],
        ['History', 'documentary'],
        ['Nat Geo WILD', 'documentary'],
        ['MTV Hits', 'music'],
        ['Quiero Musica', 'music'],
    ])('reads "%s" as %s', (title, genre) => {
        expect(channelGenre(title)).toBe(genre);
    });

    it.each(['Telefe', 'La 1', 'ITV 1', 'TNTSport', 'Antena 3', 'Canal 10'])(
        'says nothing of "%s"',
        (title) => {
            expect(channelGenre(title)).toBeNull();
        }
    );
});
