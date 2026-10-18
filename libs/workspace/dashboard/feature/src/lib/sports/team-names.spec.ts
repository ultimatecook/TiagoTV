import { isSameTeam, teamDisplayName, teamKey } from './team-names';

describe('teamKey', () => {
    it('drops accents, club affixes, punctuation and founding years', () => {
        expect(teamKey('Sevilla FC')).toBe('sevilla');
        expect(teamKey('SC Cambuur')).toBe('cambuur');
        expect(teamKey('Como 1907')).toBe('como');
        expect(teamKey('Bayer 04 Leverkusen')).toBe('bayer leverkusen');
        expect(teamKey('1. FC Union Berlin')).toBe('union berlin');
        expect(teamKey('CA Osasuna')).toBe('osasuna');
        expect(teamKey('Racing de Santander')).toBe('racing santander');
        expect(teamKey('Deportivo Alavés')).toBe('alaves');
    });

    it("maps other languages' names and nicknames to one", () => {
        expect(teamKey('FC Séville')).toBe(teamKey('Sevilla FC'));
        expect(teamKey('FC Barcelone')).toBe(teamKey('FC Barcelona'));
        expect(teamKey('Groningue')).toBe(teamKey('Groningen'));
        expect(teamKey('Côme')).toBe(teamKey('Como 1907'));
        expect(teamKey('OM')).toBe(teamKey('Olympique de Marseille'));
        expect(teamKey("Borussia M'gladbach")).toBe(
            teamKey('Borussia Mönchengladbach')
        );
        expect(teamKey('Celta Vigo')).toBe(teamKey('RC Celta'));
        expect(teamKey('Athletic Club')).toBe(teamKey('Athletic Bilbao'));
        expect(teamKey('Man Utd')).toBe(teamKey('Manchester United'));
    });
});

describe('isSameTeam', () => {
    it('takes a shorter name held in a longer one', () => {
        expect(isSameTeam(teamKey('AZ'), teamKey('AZ Alkmaar'))).toBe(true);
        expect(
            isSameTeam(
                teamKey('Real Sociedad San Sebastian'),
                teamKey('Real Sociedad')
            )
        ).toBe(true);
        expect(isSameTeam(teamKey('Freiburg'), teamKey('SC Freiburg'))).toBe(
            true
        );
    });

    it('keeps different clubs apart', () => {
        expect(
            isSameTeam(teamKey('Real Madrid'), teamKey('Real Sociedad'))
        ).toBe(false);
        expect(
            isSameTeam(teamKey('Manchester United'), teamKey('Manchester City'))
        ).toBe(false);
        expect(
            isSameTeam(teamKey('Real Madrid'), teamKey('Atlético de Madrid'))
        ).toBe(false);
        expect(isSameTeam('', 'sevilla')).toBe(false);
    });
});

describe('teamDisplayName', () => {
    it("gives the Spanish or English name for another language's", () => {
        expect(teamDisplayName('FC Séville')).toBe('Sevilla');
        expect(teamDisplayName('FC Barcelone')).toBe('Barcelona');
        expect(teamDisplayName('Groningue')).toBe('Groningen');
        expect(teamDisplayName('OM')).toBe('Marseille');
    });

    it('keeps any other name as written', () => {
        expect(teamDisplayName('Real Madrid')).toBe('Real Madrid');
        expect(teamDisplayName('Sevilla FC')).toBe('Sevilla FC');
        expect(teamDisplayName('Málaga')).toBe('Málaga');
    });
});
