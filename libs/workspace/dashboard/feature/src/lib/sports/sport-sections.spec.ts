import {
    channelInSection,
    competitionLogo,
    findSportSection,
    isFootball,
    isSectionCategory,
    namesOtherSport,
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
        // LALIGA+ carried the other competitions, never the top flight.
        expect(
            channelInSection(laliga, 'ES: LALIGA+ PPV 7', '|ES| ✪ LALIGA+ PPV')
        ).toBe(false);
        expect(
            channelInSection(laliga, '|ES| ✪ LALIGA+ PPV', '|ES| ✪ LALIGA+ PPV')
        ).toBe(false);
        expect(
            channelInSection(
                laliga,
                'M+ LaLigaTV 3 HD Orange',
                '|ES| ✪ LALIGA ORANGE'
            )
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
        expect(id('Copa de la Liga Profesional')).toBe('liga-argentina');
        expect(id('Argentine Primera División')).toBe('liga-argentina');
        expect(id('Supercopa Argentina')).toBe('liga-argentina');
        expect(id('Primera Nacional - Argentina')).toBe('rest-of-world');
        expect(id('Torneo Proyección - Argentina')).toBe('rest-of-world');
        expect(id('Primera División - Chile')).toBe('rest-of-world');
    });

    it("leaves other countries' Liga Profesional and other Argentine sports out", () => {
        expect(id('Liga Profesional de Fútbol - Panamá')).toBe('rest-of-world');
        expect(id('LPF - Panamá')).toBe('rest-of-world');
        expect(id('Liga Profesional Saudí')).toBe('rest-of-world');
        expect(id('Liga Nacional de Básquet - Argentina')).toBe('basketball');
        for (const competition of [
            'Liga Argentina de Vóley',
            'Superliga Argentina de Voleibol',
            'Liga Argentina de Futsal',
            'Liga Argentina de Handball',
            'Abierto Argentino de Polo',
            'Copa Libertadores de Futsal',
        ]) {
            expect([competition, id(competition)]).toEqual([competition, null]);
        }
        // A basketball match its feed files under the football league.
        expect(
            id('Liga Profesional Argentina', 'Quilmes Básquet - Obras')
        ).toBeNull();
    });

    it("gives the Liga Profesional its own feeds and Argentina's broadcasters only", () => {
        const argentina = section('liga-argentina');
        const ARG = '|LAT|  ✪ ARGENTINA';
        const takes = (name: string, category = ARG) =>
            channelInSection(argentina, name, category);

        expect(
            takes(
                'US (P+) Argentina Liga Profesional De Futbol 4',
                '|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT'
            )
        ).toBe(true);
        // ESPN Premium (still listed by its old name) and TNT Sports.
        expect(takes('|ARG| FOX SPORTS PREMIUM ᴴᴰ')).toBe(true);
        expect(takes('|ARG| ESPN PREMIUM ᴴᴰ')).toBe(true);
        expect(takes('|ARG| TNT SPORTS ᴴᴰ')).toBe(true);
        // TyC Sports (the Copa Argentina), at home and abroad.
        expect(takes('|ARG| TYC SPORTS ᴴᴰ')).toBe(true);
        expect(takes('|US| TYC SPORTS ᴴᴰ', '|US| ✪ SPORTS')).toBe(true);
        // Argentina's other channels carry no league match.
        for (const name of [
            '|ARG| ESPN 2',
            '|ARG| FOX SPORTS 1 ᴴᴰ',
            '|ARG| DIRECT TV SPORTS',
            '|ARG| DEPORTV',
            '|ARG| TELEFE ᴴᴰ',
            '|ARG| STAR PREMIUM ᴴᴰ',
        ]) {
            expect([name, takes(name)]).toEqual([name, false]);
        }
        // Another country's TNT Sports never shows it.
        expect(takes('|UK| TNT SPORTS 1 ᴴᴰ', '|UK| ✪ SPORTS')).toBe(false);
        expect(takes('CHL TNT Sports Premium 2 HD CL', '|LAT|  ✪ CHILE')).toBe(
            false
        );
        // Nor does a generic sports channel.
        expect(takes('|UK| SKY SPORTS MAIN EVENT ᴴᴰ', '|UK| ✪ SPORTS')).toBe(
            false
        );
        expect(takes('|ES| M. Deportes 2 ᴴᴰ', '|ES| ✪ DEPORTES')).toBe(false);
    });

    it("reads the competitions' own categories and their broadcasters' country", () => {
        expect(isSectionCategory('|LAT|  ✪ ARGENTINA')).toBe(true);
        expect(
            isSectionCategory('|LAT|  ✪ ARGENTINA LIGA PROFESIONAL FOT')
        ).toBe(true);
        expect(isSectionCategory('|ES| ✪ DAZN LA LIGA')).toBe(true);
        expect(isSectionCategory('|UK| ✪ SPORTS')).toBe(false);
        expect(isSectionCategory('|ES| ✪ CINEMA')).toBe(false);
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
        expect(
            channelInSection(rest, '|US|  GOL TV ᵁᴴᴰ', '|US| ✪ SPORTS')
        ).toBe(true);
        // Spain's GOL (summaries, films), and a channel closed years ago.
        expect(
            channelInSection(rest, '|ES| GOL TV ᴴᴰ', '|ES| ✪ DEPORTES')
        ).toBe(false);
        expect(
            channelInSection(rest, '|US| Fox Soccer Plus ᴴᴰ', '|US| ✪ SPORTS')
        ).toBe(false);
    });
});

describe('namesOtherSport', () => {
    it.each([
        ['ligue-1', '|ES| ✪ FORMULA 1', true],
        ['laliga', '|ES| ✪ DAZN ACB', true],
        ['premier-league', '|UK| ✪ BOXING EVENT', true],
        ['basketball', '|ES| ✪ DAZN ACB', false],
        ['motor', '|ES| ✪ FORMULA 1', false],
        ['tennis', '|ES| ✪ FORMULA 1', true],
        ['ligue-1', '|ES| ✪ DAZN EVENT', false],
        ['laliga', '|ES| ✪ LALIGA PPV', false],
    ] as const)('%s on "%s": %s', (section, category, other) => {
        expect(namesOtherSport(section, category)).toBe(other);
    });
});

describe('competitionLogo', () => {
    it('keeps the basketball card’s NBA logo for the NBA', () => {
        const basketball = findSportSection('basketball');
        expect(competitionLogo(basketball, 'NBA')).toBe(basketball?.logo);
        expect(
            competitionLogo(basketball, 'Super League Basketball')
        ).toBeNull();
        expect(competitionLogo(basketball, 'Liga Endesa')).toBeNull();
        const laliga = findSportSection('laliga');
        expect(competitionLogo(laliga, 'LALIGA EA SPORTS')).toBe(laliga?.logo);
        expect(competitionLogo(null, 'NBA')).toBeNull();
    });
});
