import { groupChannelFamilies } from './channel-families';
import { feedCards, signalCards } from './signal-cards';
import type { SportChannel, SportMatch } from './sports-catalog';

const channel = (
    streamId: number,
    title: string,
    icon: string | null = null
): SportChannel => ({ streamId, categoryId: '5', title, icon });

function liveMatch(
    streamId: number,
    title: string,
    via: SportMatch['via'] = []
): SportMatch {
    const [home, away] = title.split(' - ');
    return {
        ...channel(streamId, title, 'https://logos.test/pl.png'),
        key: `premier-league|${title}`,
        keys: [],
        event: {
            status: 'live',
            title,
            home,
            away,
            competition: 'Premier League',
            start: null,
            country: 'ES',
        },
        sectionId: 'premier-league',
        via,
        channelName: via[0]?.name ?? 'Premier League PPV',
    };
}

describe('signal cards', () => {
    const families = groupChannelFamilies([
        channel(11, 'DAZN LALIGA 1 HD', 'https://logos.test/dazn.png'),
        channel(12, 'DAZN LALIGA 2 HD'),
        channel(13, 'DAZN LALIGA 2 HD B'),
        channel(20, 'M+ LALIGA TV HD', 'https://logos.test/mlaliga.png'),
    ]);

    it('lists every numbered feed of the channels, one card each', () => {
        const cards = signalCards(families, []);

        expect(cards.map((card) => [card.name, card.number])).toEqual([
            ['DAZN LaLiga 1', 1],
            ['DAZN LaLiga 2', 2],
            ['M+ LaLiga TV', null],
        ]);
        // The feed's playing copy, not its backup.
        expect(cards[1].channel.streamId).toBe(12);
        expect(cards[1].channel.title).toBe('DAZN LaLiga 2');
        // The bundled brand logo first, then the provider's.
        expect(cards[0].logos[0]).toMatch(/assets\/channels\/dazn\.png$/);
        expect(cards[0].logos).toContain('https://logos.test/dazn.png');
    });

    it('puts the live matches with a feed of their own first', () => {
        const leeds = liveMatch(40, 'Leeds United - Manchester United');
        const viaOnly = liveMatch(11, 'Real Madrid - Getafe', [
            { name: 'DAZN LaLiga', channel: channel(11, 'DAZN LaLiga 1') },
        ]);

        const cards = signalCards(families, [leeds, viaOnly, leeds]);

        expect(cards.map((card) => card.channel.streamId)).toEqual([
            40, 11, 12, 20,
        ]);
        expect(cards[0]).toEqual(
            expect.objectContaining({
                name: 'Premier League PPV',
                number: null,
                match: leeds,
                logos: ['https://logos.test/pl.png'],
            })
        );
        expect(cards[1].match).toBeNull();
    });

    it('puts the broadcasters first and the pay-per-view passes last', () => {
        const withPasses = groupChannelFamilies([
            channel(30, 'ES: LALIGA+ PPV 1'),
            channel(31, 'ES: LALIGA+ PPV 2'),
            channel(32, 'ES: LALIGA+ PPV 3'),
            channel(20, 'M+ LALIGA TV HD'),
            channel(11, 'DAZN LALIGA 1 HD'),
        ]);

        expect(signalCards(withPasses, []).map((card) => card.name)).toEqual([
            'DAZN LaLiga',
            'M+ LaLiga TV',
            'LaLiga+ PPV 1',
            'LaLiga+ PPV 2',
            'LaLiga+ PPV 3',
        ]);
    });
});

describe('feed cards', () => {
    it('makes a card of each signal of the match, its brand’s logo first', () => {
        const match: SportMatch = {
            ...liveMatch(21, 'Paris Saint-Germain - Barcelona'),
            feeds: [
                {
                    channel: channel(21, 'M+ Liga de Campeones'),
                    name: 'Movistar Liga de Campeones',
                    number: null,
                    language: 'ES',
                    label: 'España',
                    flag: 'es',
                    named: false,
                    quality: 'HD',
                },
                {
                    channel: channel(
                        22,
                        'UEFA | 05 - PSG vs Barcelona',
                        'https://logos.test/uefa.png'
                    ),
                    name: 'UEFA Champions League',
                    number: 5,
                    language: 'UK',
                    label: 'Inglés (UK)',
                    flag: 'gb',
                    named: true,
                    quality: null,
                },
            ],
        };

        const cards = feedCards(match);

        expect(cards.map((card) => [card.key, card.name, card.number])).toEqual(
            [
                ['feed:21', 'Movistar Liga de Campeones', null],
                ['feed:22', 'UEFA Champions League', 5],
            ]
        );
        expect(cards[0].logos[0]).toContain('movistar');
        expect(cards[1].logos).toEqual(['https://logos.test/uefa.png']);
        expect(cards[1].feed?.label).toBe('Inglés (UK)');
        expect(cards.every((card) => card.match === match)).toBe(true);
    });

    it('has none for a match without signals', () => {
        expect(feedCards(liveMatch(1, 'A - B'))).toEqual([]);
    });
});
