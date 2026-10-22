import { episodeOwnName, inlinePlayerHeading } from './inline-player-heading';

const english = (season: number, episode: number) => `S${season}:E${episode}`;
const spanish = (season: number, episode: number) => `T${season}:E${episode}`;

describe('inlinePlayerHeading', () => {
    it('names a film without its year and language tag', () => {
        expect(
            inlinePlayerHeading({
                title: 'Muertos S.L. (2024) ES',
                code: english,
            })
        ).toEqual({ primary: 'Muertos S.L.', secondary: null });
    });

    it('names an episode under its show, with a short code and its own name', () => {
        expect(
            inlinePlayerHeading({
                title: 'Our Great National Parks (2022) ES - S01E02 - Chilean Patagonia',
                seriesTitle: 'Our Great National Parks (2022) ES',
                episode: {
                    seasonNumber: 1,
                    episodeNumber: 2,
                    title: 'Our Great National Parks (2022) ES - S01E02 - Chilean Patagonia',
                },
                code: english,
            })
        ).toEqual({
            primary: 'Our Great National Parks',
            secondary: 'S1:E2 · Chilean Patagonia',
        });
    });

    it('words the code in the UI language', () => {
        expect(
            inlinePlayerHeading({
                title: 'Fauda',
                seriesTitle: '|ES| Fauda [2015]',
                episode: {
                    seasonNumber: 3,
                    episodeNumber: 10,
                    title: 'Fauda - 3x10 - Final',
                },
                code: spanish,
            })?.secondary
        ).toBe('T3:E10 · Final');
    });

    it('keeps the bare code when the episode has no name of its own', () => {
        expect(
            inlinePlayerHeading({
                title: 'Dark',
                seriesTitle: 'Dark (2017)',
                episode: {
                    seasonNumber: 2,
                    episodeNumber: 1,
                    title: 'Episode 1',
                },
                code: english,
            })
        ).toEqual({ primary: 'Dark', secondary: 'S2:E1' });
    });

    it('has no heading without a title', () => {
        expect(inlinePlayerHeading({ title: '  ', code: english })).toBeNull();
    });
});

describe('episodeOwnName', () => {
    it.each([
        [
            'Show (2022) ES - S01E02 - Chilean Patagonia',
            'Show',
            'Chilean Patagonia',
        ],
        ['S01 E05 The Return', 'Show', 'The Return'],
        ['Show - The Pilot', 'Show', 'The Pilot'],
        ['The Pilot', 'Show', 'The Pilot'],
        ['Show (2022) - S01E02', 'Show', null],
        ['Show', 'Show (2022)', null],
        ['Capítulo 4', 'Show', null],
        ['', 'Show', null],
    ])('"%s" of "%s" → %s', (raw, show, expected) => {
        expect(episodeOwnName(raw, show)).toBe(expected);
    });
});
