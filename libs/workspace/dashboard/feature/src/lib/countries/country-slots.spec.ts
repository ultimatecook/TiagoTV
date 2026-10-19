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
