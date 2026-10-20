import { sharpImageUrl } from './sharp-image-url';

const TMDB = 'https://image.tmdb.org/t/p';

describe('sharpImageUrl', () => {
    it('asks TMDB for a poster wide enough for its card on a 2× screen', () => {
        // A provider's w185 poster on a 250px card: 500 device px needed.
        expect(sharpImageUrl(`${TMDB}/w185/abc.jpg`, 'poster', 250, 2)).toBe(
            `${TMDB}/w500/abc.jpg`
        );
        expect(sharpImageUrl(`${TMDB}/w300/abc.jpg`, 'poster', 320, 2)).toBe(
            `${TMDB}/w780/abc.jpg`
        );
    });

    it('asks for the original backdrop where w1280 would be upscaled', () => {
        expect(
            sharpImageUrl(`${TMDB}/w780/bd.jpg`, 'backdrop', 1800, 1.67)
        ).toBe(`${TMDB}/original/bd.jpg`);
        expect(sharpImageUrl(`${TMDB}/w300/bd.jpg`, 'backdrop', 600, 2)).toBe(
            `${TMDB}/w1280/bd.jpg`
        );
    });

    it('keeps a size that is already sharp enough', () => {
        for (const url of [
            `${TMDB}/w500/abc.jpg`,
            `${TMDB}/w600_and_h900_bestv2/abc.jpg`,
            `${TMDB}/original/abc.jpg`,
        ]) {
            expect(sharpImageUrl(url, 'poster', 240, 2)).toBe(url);
        }
    });

    it('reads the website sizes by their width or height', () => {
        expect(
            sharpImageUrl(
                `${TMDB}/w220_and_h330_face/abc.jpg`,
                'poster',
                300,
                2
            )
        ).toBe(`${TMDB}/w780/abc.jpg`);
        expect(sharpImageUrl(`${TMDB}/h632/abc.jpg`, 'poster', 300, 1)).toBe(
            `${TMDB}/h632/abc.jpg`
        );
    });

    it('counts a pixel ratio under 1 (a zoomed-out page) as 1', () => {
        expect(sharpImageUrl(`${TMDB}/w185/abc.jpg`, 'poster', 300, 0.8)).toBe(
            `${TMDB}/w342/abc.jpg`
        );
    });

    it('never touches a URL that is not a plain TMDB image link', () => {
        for (const url of [
            'http://provider.example:8080/images/w185/abc.jpg',
            'http://provider.example/img.php?u=https://image.tmdb.org/t/p/w185/a.jpg',
            'https://user:secret@image.tmdb.org/t/p/w185/abc.jpg',
            `${TMDB}/w185/abc.jpg?token=secret`,
            'https://image.tmdb.org:8443/t/p/w185/abc.jpg',
            'https://image.tmdb.org.evil.example/t/p/w185/abc.jpg',
            'https://image.tmdb.org/t/p/w185/nested/abc.jpg',
            'not a url',
            '',
        ]) {
            expect(sharpImageUrl(url, 'poster', 400, 2)).toBe(url);
        }
    });
});
