import { nowPlayingHeading } from './now-playing-heading';

describe('nowPlayingHeading', () => {
    it('names an event channel by its match, over the competition', () => {
        expect(
            nowPlayingHeading({
                title: 'Next | 2026-10-18 | 12:45 (GMT) | Bournemouth - Sunderland | Premier League | ES',
                subtitle: null,
                isLive: true,
            })
        ).toEqual({
            title: 'Bournemouth - Sunderland',
            subtitle: 'Premier League',
        });
    });

    it('cleans an ordinary channel and keeps its programme', () => {
        expect(
            nowPlayingHeading({
                title: '|ES| DAZN LALIGA ᴴᴰ',
                subtitle: 'Real Madrid - Getafe',
                isLive: true,
            })
        ).toEqual({ title: 'DAZN LALIGA', subtitle: 'Real Madrid - Getafe' });
        expect(
            nowPlayingHeading({
                title: 'ES: LALIGA+ PPV 1',
                subtitle: null,
                isLive: true,
            })
        ).toEqual({ title: 'LALIGA+ PPV 1', subtitle: null });
    });

    it('shows a film or episode as it is called', () => {
        expect(
            nowPlayingHeading({
                title: 'MUERTOS S.L. (2024) ES',
                subtitle: 'S1 · E2',
                isLive: false,
            })
        ).toEqual({ title: 'MUERTOS S.L.', subtitle: 'S1 · E2' });
    });
});
