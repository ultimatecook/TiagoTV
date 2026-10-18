import { competitionChannels, sectionsWithChannels } from './match-channels';
import { buildSportsCatalog, type SportChannel } from './sports-catalog';

const channel = (streamId: number, title: string): SportChannel => ({
    streamId,
    categoryId: '1',
    title,
    icon: null,
});

describe('competitionChannels', () => {
    it("puts the broadcasters' channels first, the pay-per-view passes last", () => {
        const options = competitionChannels([
            channel(1, 'LALIGA+ PPV 1'),
            channel(2, 'LALIGA+ PPV 2'),
            channel(3, 'LALIGA+ PPV 3'),
            channel(4, 'LA LIGA'),
            channel(5, 'M LA LIGA TV'),
            channel(6, 'M+ LaLigaTV 2 Orange'),
            channel(7, 'M+ LaLigaTV 3 Orange'),
            channel(8, 'DAZN LIGA'),
            channel(9, 'DAZN LIGA 2'),
        ]);

        expect(options.map((option) => option.name)).toEqual([
            'M+ LaLiga TV',
            'DAZN LaLiga',
            'LaLiga TV',
            'LaLiga+ PPV',
        ]);
        // Each plays its first feed, named after it.
        expect(options[0].channel).toMatchObject({
            streamId: 5,
            title: 'M+ LaLiga TV',
        });
    });

    it("leaves out a slot still named after another day's event", () => {
        const options = competitionChannels([
            channel(1, 'M+LCAMPEON'),
            channel(2, 'UEFA | 13 - Aston Villa vs Ajax 20.00'),
        ]);

        expect(options.map((option) => option.name)).toEqual([
            'Movistar Liga de Campeones',
        ]);
    });
});

describe('sectionsWithChannels', () => {
    it('lists the single competitions whose channels the source keeps', () => {
        const catalog = buildSportsCatalog(
            [
                { category_id: 1, category_name: '|ES| ✪ LALIGA' },
                { category_id: 2, category_name: '|ES| ✪ DAZN ACB' },
                { category_id: 3, category_name: '|FR| ✪ BEIN SPORTS' },
            ],
            [
                { stream_id: 1, name: '|ES| M LA LIGA TV ᴴᴰ', category_id: 1 },
                { stream_id: 2, name: '|ES| DAZN ACB 1', category_id: 2 },
                { stream_id: 3, name: '|FR| BEIN SERIE A', category_id: 3 },
            ]
        );

        expect([...sectionsWithChannels(catalog)]).toEqual(['laliga']);
    });
});
