import type { DashboardHeroSlide } from './dashboard-hero.utils';
import { heroEyebrowKey, heroMetaParts } from './home-hero.utils';

const slide = (overrides: Partial<DashboardHeroSlide>): DashboardHeroSlide => ({
    id: 'a',
    kind: 'continue',
    contentType: 'movie',
    playlistId: 'p',
    categoryId: '1',
    title: 'Title',
    typeLabelKey: 'TYPE_MOVIE',
    reasonLabelKey: 'CONTINUE_WATCHING',
    episodeBadge: null,
    rating: null,
    genres: [],
    year: null,
    source: 'Source',
    programmeTitle: null,
    category: null,
    timeRange: null,
    description: null,
    progress: null,
    accentHue: 0,
    backdropSource: 'fallback',
    hasBackdrop: false,
    primaryAction: {
        labelKey: 'HERO_CONTINUE',
        icon: 'play_arrow',
        link: [],
        testId: 'x',
    },
    secondaryAction: null,
    ...overrides,
});

const translate = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${JSON.stringify(params)})` : key;

describe('heroMetaParts', () => {
    it('says where in a show and how much is left', () => {
        expect(
            heroMetaParts(
                slide({
                    contentType: 'series',
                    episodeBadge: 'T2·E5',
                    primaryAction: {
                        ...slide({}).primaryAction,
                        remainingLabel: {
                            key: 'LEFT',
                            params: { minutes: 23 },
                        },
                    },
                }),
                translate
            )
        ).toEqual(['T2·E5', 'LEFT({"minutes":23})']);
    });

    it('calls a film a film, and adds nothing it does not know', () => {
        expect(heroMetaParts(slide({}), translate)).toEqual(['TYPE_MOVIE']);
    });

    it("gives a channel's programme and its hours", () => {
        expect(
            heroMetaParts(
                slide({
                    kind: 'live',
                    contentType: 'live',
                    programmeTitle: 'News',
                    timeRange: '20:00 – 21:00',
                }),
                translate
            )
        ).toEqual(['News', '20:00 – 21:00']);
    });

    it('describes a discovery pick by its kind, year and first genre', () => {
        expect(
            heroMetaParts(
                slide({
                    kind: 'added',
                    year: 2024,
                    genres: ['Drama', 'Crime'],
                }),
                translate
            )
        ).toEqual(['TYPE_MOVIE', '2024', 'Drama']);
    });
});

describe('heroEyebrowKey', () => {
    it('reads "Seguir viendo" over an unfinished title only', () => {
        expect(heroEyebrowKey(slide({}))).toBe(
            'WORKSPACE.DASHBOARD.KEEP_WATCHING'
        );
        expect(
            heroEyebrowKey(slide({ kind: 'favorite', reasonLabelKey: 'FAV' }))
        ).toBe('FAV');
    });
});
