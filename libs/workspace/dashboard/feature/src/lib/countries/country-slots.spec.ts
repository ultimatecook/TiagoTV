import { isEmptySlot, slotWindow, stripWindow } from './country-slots';

const NOW = new Date('2026-10-18T18:00:00Z');

describe('isEmptySlot', () => {
    it.each([
        ['ES | No Event', 'DAZN Event'],
        ['LIVE EVENT 03 - NO EVENT', 'Live Event'],
        ['End | Udinese - Lecce | Serie A | ES', 'DAZN Serie A'],
        ['|ES| LALIGA+ PPV 3', 'LaLiga+ PPV'],
        ['|ES| 2RFEF 1', '2RFEF Solo Eventos'],
        ['|IE|ᴴᴰ| GAAGO 04 (EVENTS)', 'Ireland Sport Event'],
        ['ULSTER GAA 06 |', 'Ireland Sport Event'],
        ['|US| NETFLIX 01 Events Only', 'Netflix Event'],
        ['|UK| TNT Sports | Event 2', 'TNT Sports Event'],
        ['NHL | 03 -', 'NHL'],
        ['|US| BOXING PPV 00:', 'Boxing'],
        ['MLB 05 :', 'MLB'],
        [
            'MLB 02 : Brewers x Dodgers start:2026-10-16 01:00:00 stop:2026-10-16 08:13:20',
            'MLB',
        ],
        [
            'LOI TV 1 | Wexford v Galway United  start: 2026-09-26 17:45:00  stop: 2026-09-26 20:45:00',
            'Ireland Sport Event',
        ],
    ])('leaves out "%s" (%s)', (name, label) => {
        expect(isEmptySlot(name, label, NOW)).toBe(true);
    });

    it.each([
        ['|ARG| TELEFE ᴴᴰ', null],
        [
            'Live | Leeds United - Manchester United | Premier League | ES',
            'Premier League PPV',
        ],
        ['NHL | 01 - 6pm Blue Jackets at Wild', 'NHL'],
        ['LIVE EVENT 02 - 8AM WWE Crown Jewel Perth', 'Live Event'],
        ['|US| MLB NETWORK', 'MLB'],
        ['|UK| UFC EVENT', 'PPV UFC'],
        // Numbered channels outside a category of slots are channels.
        ['|ES| NBA TV 3', 'NBA'],
        ['|ES| DAZN 1', 'DAZN Live'],
        ['Argentina Liga Profesional De Futbol 4', 'Liga Profesional'],
        [
            'MLB 01 : Rays x Guardians start:2026-10-18 22:08:00 stop:2026-10-19 05:21:20',
            'MLB',
        ],
    ])('keeps "%s" (%s)', (name, label) => {
        expect(isEmptySlot(name, label, NOW)).toBe(false);
    });
});

describe('isEmptySlot by the clock', () => {
    /** The panel's `added`: epoch seconds. */
    const at = (iso: string) => String(Date.parse(iso) / 1000);

    it.each([
        // A match announced for 13:00 GMT, long over at 18:00.
        [
            'Next | 2026-10-18 | 13:00 (GMT) | Kayanza United vs. Rukinzo | Ligue A - Burundi | ES',
            'DAZN Event',
            at('2026-10-18T08:04:00Z'),
        ],
        // Named "Live" at 12:46: a league match ends within 2¼ hours.
        [
            'Live | Leeds United - Manchester United | Premier League | ES',
            'Premier League PPV',
            at('2026-10-18T12:46:00Z'),
        ],
        // A feed with no kick-off that kept its name for days.
        [
            'Next | 20:45 - 23 (GMT) | Real Madrid - FC Séville [und] | LaLiga | FR',
            'DAZN Event',
            at('2026-10-15T09:00:00Z'),
        ],
        // Numbered slots still named after April's and July's festivals.
        [
            'LIVE EVENT 26 - MAIN STAGE Live From Coachella 2026',
            'Live Event',
            at('2026-04-11T11:52:00Z'),
        ],
        [
            'ULSTER GAA 01 | Ballymacnab v Keady',
            'Ireland Sport Event',
            at('2025-09-07T12:58:00Z'),
        ],
    ])('leaves out the finished "%s" (%s)', (name, label, added) => {
        expect(isEmptySlot(name, label, NOW, added)).toBe(true);
    });

    it.each([
        // Kicked off at 16:00: a match of a cup can still be on.
        [
            'Next | 2026-10-18 | 16:00 (GMT) | Masters FC vs. Karonga United | FDH Bank Premiership - Malawi | ES',
            'DAZN Event',
            at('2026-10-18T10:10:00Z'),
        ],
        [
            'Next | 2026-10-19 | 19:00 (GMT) | Burgos CF - CE Sabadell | LALIGA HYPERMOTION | ES',
            'LaLiga Hypermotion PPV',
            at('2026-10-18T08:04:00Z'),
        ],
        // A six-hour race named "Live" at 12:30 runs past 18:00.
        [
            'Live | 6 horas de Barcelona | FIA World Endurance | ES',
            'DAZN Event',
            at('2026-10-18T12:30:00Z'),
        ],
        // A weekend's games are named midweek; Monday's is still to come.
        [
            'NFL  | 14 - MNF 8:15pm Commanders at 49ers',
            'NFL',
            at('2026-10-14T22:42:00Z'),
        ],
        [
            'LIVE EVENT 01 - 2pm STSS Octoberfest Hagerstown',
            'Live Event',
            at('2026-10-18T03:11:00Z'),
        ],
        // Channels of a category of events, named years ago.
        ['UK Sky Sports+ FHD', 'Sky Sport + PPV', at('2024-08-11T02:10:00Z')],
        [
            '|UK| TNT SPORTS 5 ᵁᴴᴰ D',
            'TNT Sports Event',
            at('2023-07-31T01:29:00Z'),
        ],
        ['NFL | BEARS', 'NFL Teams', at('2022-12-24T20:55:00Z')],
    ])('keeps "%s" (%s)', (name, label, added) => {
        expect(isEmptySlot(name, label, NOW, added)).toBe(false);
    });

    it('ends a dated game six hours after its Eastern time', () => {
        const game = 'FC Cincinnati vs Columbus Crew @ Oct 18 4:30 PM :MLS  17';
        expect(isEmptySlot(game, 'MLS PPV', NOW)).toBe(false);
        expect(
            isEmptySlot(game, 'MLS PPV', new Date('2026-10-19T04:00:00Z'))
        ).toBe(true);
    });
});

describe('slotWindow', () => {
    it('reads a slot’s broadcast window, and the name without it', () => {
        const title =
            'UFC 03 : CAGE WARRIORS 211 start:2026-10-17 20:25:00 stop:2026-10-18 00:30:00';
        expect(slotWindow(title)).toEqual({
            start: new Date('2026-10-17T20:25:00Z'),
            stop: new Date('2026-10-18T00:30:00Z'),
        });
        expect(stripWindow(title)).toBe('UFC 03 : CAGE WARRIORS 211');
        expect(slotWindow('|ES| La 1')).toBeNull();
    });
});
