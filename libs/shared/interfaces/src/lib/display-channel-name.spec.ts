import {
    cleanChannelName,
    displayChannelName,
    isEventChannelName,
    isIdleEventChannel,
} from './display-channel-name';

describe('displayChannelName', () => {
    it.each([
        [
            'Next | 2026-10-18 | 12:45 (GMT) | Bournemouth - Sunderland | Premier League | ES',
            'Bournemouth - Sunderland',
            'Premier League',
        ],
        [
            'Live | Leeds United - Manchester United | Premier League | ES',
            'Leeds United - Manchester United',
            'Premier League',
        ],
        ['End | Udinese - Lecce | Serie A | ES', 'Udinese - Lecce', 'Serie A'],
        [
            'NEXT | SHAUN MURPHY - LIAM DAVIES | Sun 18 Oct 22:00 CEST (SE) | 8K EXCLUSIVE | SE: MAX PPV 17',
            'SHAUN MURPHY - LIAM DAVIES',
            'MAX PPV 17',
        ],
        [
            'Live | El Post | Jornada 9 | LALIGA | ES',
            'El Post · Jornada 9',
            'LALIGA',
        ],
        ['Live | Gran Premio de Japón | ES', 'Gran Premio de Japón', null],
    ])('reads the event channel "%s"', (raw, title, subtitle) => {
        expect(displayChannelName(raw)).toEqual({ title, subtitle });
    });

    it.each([
        ['|ES| DAZN LALIGA ᴴᴰ', 'DAZN LALIGA'],
        ['ES | No Event', 'No Event'],
        ['LIVE EVENT 25 - NO EVENT', 'LIVE EVENT 25 - NO EVENT'],
    ])('names the ordinary channel "%s" "%s"', (raw, title) => {
        expect(displayChannelName(raw)).toEqual({ title, subtitle: null });
    });
});

describe('cleanChannelName', () => {
    it.each([
        ['|ES| Movistar LaLiga FHD', 'Movistar LaLiga'],
        ['ES: LALIGA+ PPV 1', 'LALIGA+ PPV 1'],
        ['ES| DAZN 1 HD', 'DAZN 1'],
        ['UK | ITV Central East', 'ITV Central East'],
        ['| UK | SKY SPORTS ACTION ᵁᴴᴰ', 'SKY SPORTS ACTION'],
        ['|IT|  SKY SPORT BAR DUE ᵁᴴᴰ', 'SKY SPORT BAR DUE'],
        ['|IT| SKY SPORT MAX ˢᴰ', 'SKY SPORT MAX'],
        ['|DE| Eurosport 2 ᶠᴴᴰ', 'Eurosport 2'],
        ['C+AF: CANAL+ SPORT 1 HD', 'CANAL+ SPORT 1'],
        ['|NL| Sbs 9 (ᴴᴰ)', 'Sbs 9'],
        ['Discovery 4K', 'Discovery'],
        ['|DSTV| Tshwane TV ᴴᴰ ZA', 'Tshwane TV ZA'],
    ])('cleans "%s"', (raw, expected) => {
        expect(cleanChannelName(raw)).toBe(expected);
    });

    it.each([
        'Spotify | Bass Boosted Playlist',
        'La 1',
        'TMC |-2H|',
        'beIN SPORTS 1',
    ])('keeps "%s" as it is', (name) => {
        expect(cleanChannelName(name)).toBe(name);
    });

    it('never empties a name', () => {
        expect(cleanChannelName('|ES|')).toBe('|ES|');
        expect(cleanChannelName('ᴴᴰ')).toBe('ᴴᴰ');
    });
});

describe('isIdleEventChannel', () => {
    it.each([
        ['ES | No Event', true],
        ['FR | No Event ', true],
        ['GB|no event', true],
        ['LIVE EVENT 25 - NO EVENT', false],
        [
            'Live | Leeds United - Manchester United | Premier League | ES',
            false,
        ],
        ['|ES| DAZN 1', false],
    ])('"%s" is idle: %s', (name, idle) => {
        expect(isIdleEventChannel(name)).toBe(idle);
    });
});

describe('isEventChannelName', () => {
    it.each([
        ['Live | Leeds United - Manchester United | Premier League | ES', true],
        ['Next | 2026-10-18 | 16:00 (GMT) | Girona FC - FC Andorra | ES', true],
        ['End | Udinese vs. Lecce | Serie A Enilive | FR', true],
        ['ES | No Event', false],
        ['|ES| DAZN 1 ᴴᴰ', false],
        ['Live Sports', false],
    ])('"%s" is an event channel: %s', (name, event) => {
        expect(isEventChannelName(name)).toBe(event);
    });
});
