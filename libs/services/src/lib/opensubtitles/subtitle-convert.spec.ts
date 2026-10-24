import { hasSubtitleCues, srtToVtt } from './subtitle-convert';

describe('srtToVtt', () => {
    it('adds the header, fixes the timings and drops position tags', () => {
        const vtt = srtToVtt(
            '\uFEFF1\r\n00:01:02,5 --> 00:01:04,250 X1:10\r\n{\\an8}Hola\r\n<i>adiós</i>\r\n'
        );

        expect(vtt).toBe(
            'WEBVTT\n\n1\n00:01:02.500 --> 00:01:04.250\nHola\n<i>adiós</i>\n'
        );
        expect(hasSubtitleCues(vtt)).toBe(true);
    });

    it('leaves WebVTT as it is', () => {
        const vtt = 'WEBVTT\n\n00:00.000 --> 00:01.000\nHi\n';
        expect(srtToVtt(vtt)).toBe(vtt);
    });

    it('finds no cue in a page that is not a subtitle', () => {
        expect(hasSubtitleCues(srtToVtt('<html>quota</html>'))).toBe(false);
    });
});
