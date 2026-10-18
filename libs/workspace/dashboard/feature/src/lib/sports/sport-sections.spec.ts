import {
    channelInSection,
    findSportSection,
    isFootball,
    sectionForCompetition,
    SPORT_SECTIONS,
    type SportSection,
} from './sport-sections';

const id = (competition: string, title = 'Home FC - Away FC') =>
    sectionForCompetition(competition, title)?.id ?? null;

function section(sectionId: string): SportSection {
    const found = findSportSection(sectionId);
    if (!found) {
        throw new Error(`${sectionId} missing`);
    }
    return found;
}

describe('sport sections', () => {
    it('lists the new football cards after the Champions League, Básquet last', () => {
        expect(SPORT_SECTIONS.map((card) => card.id)).toEqual([
            'premier-league',
            'laliga',
            'tennis',
            'motor',
            'serie-a',
            'ligue-1',
            'bundesliga',
            'champions-league',
            'europa-league',
            'liga-argentina',
            'libertadores',
            'hypermotion',
            'mls',
            'eredivisie',
            'rest-of-world',
            'basketball',
        ]);
    });

    it('splits LaLiga Hypermotion out of LaLiga', () => {
        expect(id('LALIGA HYPERMOTION')).toBe('hypermotion');
        expect(id('LaLiga 2')).toBe('hypermotion');
        expect(id('LALIGA EA SPORTS')).toBe('laliga');
        expect(id('Spanish LALIGA')).toBe('laliga');

        const laliga = section('laliga');
        const hypermotion = section('hypermotion');
        const hypermotionTv = [
            '|ES| LA LIGATV 1 HYPERMOTION',
            '|ES| ✪ LALIGA HYPERMOTION',
        ] as const;
        expect(channelInSection(laliga, ...hypermotionTv)).toBe(false);
        expect(channelInSection(hypermotion, ...hypermotionTv)).toBe(true);
        expect(
            channelInSection(
                laliga,
                'HYPERMOTION 2 HD Orange',
                '|ES| ✪ LALIGA ORANGE'
            )
        ).toBe(false);
        expect(
            channelInSection(
                hypermotion,
                'HYPERMOTION 2 HD Orange',
                '|ES| ✪ LALIGA ORANGE'
            )
        ).toBe(true);
        expect(
            channelInSection(laliga, '|ES| M LA LIGA 2 ᵁᴴᴰ', '|ES| ✪ SPAIN')
        ).toBe(true);
        // The provider files the third division under Hypermotion.
        const thirdDivision = [
            '|ES| MOVISTAR PRIMERA FEDERACION FHD',
            '|ES| ✪ LALIGA HYPERMOTION',
        ] as const;
        expect(channelInSection(hypermotion, ...thirdDivision)).toBe(false);
        expect(channelInSection(laliga, ...thirdDivision)).toBe(false);
    });

    it('follows the Europa League, the Libertadores, MLS and the Eredivisie', () => {
        expect(id('UEFA Europa League')).toBe('europa-league');
        expect(id('UEFA Europa Conference League')).toBe('rest-of-world');
        expect(id('CONMEBOL Libertadores')).toBe('libertadores');
        expect(id('Copa Libertadores')).toBe('libertadores');
        expect(id('Copa Libertadores Femenina')).toBeNull();
        expect(id('CONMEBOL Sudamericana')).toBe('rest-of-world');
        expect(id('MLS')).toBe('mls');
        expect(id('Major League Soccer')).toBe('mls');
        expect(id('MLS Next Pro')).toBe('rest-of-world');
        expect(id('Eredivisie')).toBe('eredivisie');
        expect(id('Eredivisie femenina')).toBeNull();
        expect(id('UEFA Champions League')).toBe('champions-league');
        expect(id('AFC Champions League Elite')).toBe('rest-of-world');
        expect(
            channelInSection(
                section('mls'),
                'FC Cincinnati vs Columbus Crew @ Oct 18 4:30 PM :MLS  17',
                '|US| ✪ MLS PPV'
            )
        ).toBe(true);
    });

    it('takes the Argentine top flight and its cups, not the lower divisions', () => {
        expect(id('Liga Profesional Argentina')).toBe('liga-argentina');
        expect(id('Liga Profesional de Fútbol')).toBe('liga-argentina');
        expect(id('Torneo Clausura - Argentina')).toBe('liga-argentina');
        expect(id('Copa Argentina')).toBe('liga-argentina');
        expect(id('Primera Nacional - Argentina')).toBe('rest-of-world');
        expect(id('Primera División - Chile')).toBe('rest-of-world');

        const argentina = section('liga-argentina');
        expect(
            channelInSection(
                argentina,
                'US (P+) Argentina Liga Profesional De Futbol 3',
                '|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT'
            )
        ).toBe(true);
        expect(
            channelInSection(
                argentina,
                '|ARG| FOX SPORTS PREMIUM ᴴᴰ',
                '|LAT|  ✪ ARGENTINA'
            )
        ).toBe(true);
        expect(
            channelInSection(
                argentina,
                'CHL TNT Sports Premium 2 HD CL',
                '|LAT|  ✪ CHILE'
            )
        ).toBe(false);
    });

    it('sends every other football match to "Resto del mundo"', () => {
        expect(id('Super League Greece')).toBe('rest-of-world');
        expect(id('LPB')).toBe('rest-of-world');
        expect(id('Saudi Pro League')).toBe('rest-of-world');
        expect(id('Liga MX')).toBe('rest-of-world');
        expect(id('Kategoria Superiore')).toBe('rest-of-world');
        expect(id('FDH Bank Premiership - Malawi')).toBe('rest-of-world');
    });

    it('keeps other sports, women and youth out of "Resto del mundo"', () => {
        for (const competition of [
            'National Squash League',
            'PBC/TGB',
            'BKFC 95 NEWARK',
            'GLORY Kickboxing',
            'UFC',
            'NHL',
            'NFL',
            'EHF Champions League',
            'LVF A1 Fineco',
            'Investec Champions Cup',
            'Dutch Darts Championship',
            'Grand Slam of Curling',
            'FIFA Futsal World Cup',
            'BBL',
            'all',
            'Superliga e Femrave - Kosovo',
            'Championnat Féminine D1 - Morocco',
            'UEFA U-17 Championship Qualifying',
            'Copa de la Reina',
        ]) {
            expect([competition, id(competition)]).toEqual([competition, null]);
        }
        expect(id('Olbia Challenger')).toBe('tennis');
        expect(id('WorldSBK')).toBe('motor');
        expect(id('Liga Endesa')).toBe('basketball');
        expect(
            isFootball('Copa del Rey', 'Valencia Basket - Real Madrid')
        ).toBe(false);
        expect(
            isFootball('Copa del Rey', 'Real Madrid Femenino - Levante')
        ).toBe(false);
        expect(isFootball('Copa del Rey', 'Real Madrid - Levante')).toBe(true);
    });

    it('lets "Resto del mundo" gather generic football channels', () => {
        const rest = section('rest-of-world');
        expect(
            channelInSection(
                rest,
                '|ES| GOL Mundial 1 ᴴᴰ',
                '|ES| ✪ GOL MUNDIAL SOLO EVENTOS'
            )
        ).toBe(true);
        expect(
            channelInSection(
                rest,
                '|UK| SKY SPORTS FOOTBALL ᴴᴰ',
                '|UK| ✪ SPORTS'
            )
        ).toBe(true);
        expect(
            channelInSection(rest, '|ES| DAZN 1 ᴴᴰ', '|ES| ✪ DEPORTES')
        ).toBe(false);
    });
});
