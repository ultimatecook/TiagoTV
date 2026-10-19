import {
    cardsWindow,
    OVERSCAN,
    revealScroll,
    type RowGeometry,
} from './country-tv-window';

// 1600px wide, 56px of padding, cards of 196px with a 16px gap.
const ROW: RowGeometry = {
    scrollLeft: 0,
    width: 1600,
    padding: 56,
    pitch: 212,
};

describe('cardsWindow', () => {
    it('renders the cards in view and a few beyond, not the whole list', () => {
        // 1600 / 212 → 8 cards in view, one cut, and the overscan.
        expect(cardsWindow(ROW, 1587)).toEqual({ start: 0, end: 9 + OVERSCAN });
        expect(cardsWindow(ROW, 5)).toEqual({ start: 0, end: 5 });
    });

    it('follows the scroll', () => {
        const scrolled = { ...ROW, scrollLeft: 56 + 212 * 100 };
        expect(cardsWindow(scrolled, 1587)).toEqual({
            start: 100 - OVERSCAN,
            end: 109 + OVERSCAN,
        });
        // Past the end (a list that shrank under its scroll).
        expect(cardsWindow({ ...ROW, scrollLeft: 1e6 }, 10).start).toBe(9);
    });

    it('is empty for no cards', () => {
        expect(cardsWindow(ROW, 0)).toEqual({ start: 0, end: 0 });
        expect(cardsWindow({ ...ROW, pitch: 0 }, 10)).toEqual({
            start: 0,
            end: 0,
        });
    });
});

describe('revealScroll', () => {
    it('leaves a card in view alone', () => {
        expect(revealScroll(ROW, 0, 'nearest')).toBeNull();
        expect(revealScroll(ROW, 6, 'third')).toBeNull();
    });

    it('scrolls a card just into view, either way', () => {
        // Card 7 ends at 56 + 8 × 212 = 1752: scrolled until it shows.
        expect(revealScroll(ROW, 7, 'nearest')).toBe(1752 - 1600 + 56);
        const scrolled = { ...ROW, scrollLeft: 2000 };
        expect(revealScroll(scrolled, 3, 'nearest')).toBe(3 * 212);
    });

    it('puts a far card a third of the way in', () => {
        const left = 56 + 40 * 212;
        expect(revealScroll(ROW, 40, 'third')).toBeCloseTo(left - 1600 / 3);
    });
});
