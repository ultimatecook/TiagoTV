import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SportsCatalogService } from '../sports/sports-catalog.service';
import type { SportMatch } from '../sports/sports-catalog';
import type { CountryChannelGroup } from './country-channels';
import type { TvProgramme } from './country-tv-epg';
import { CountryTvGuide } from './country-tv-guide';
import { CountryTvListings } from './country-tv-listings';

function channel(title: string, ...streamIds: number[]): CountryChannelGroup {
    return {
        key: title,
        title,
        subtitle: null,
        icons: [],
        copies: streamIds.map((streamId) => ({
            streamId,
            categoryId: '1',
            title,
            icon: null,
            quality: null,
        })),
    };
}

const LALIGA_MATCH = {
    streamId: 70,
    categoryId: '9',
    title: 'Real Madrid - Sevilla',
    icon: null,
    key: 'laliga:rm:sev',
    keys: [],
    sectionId: 'laliga',
    event: {
        status: 'live',
        title: 'Real Madrid - Sevilla',
        home: 'Real Madrid',
        away: 'Sevilla',
        competition: 'LaLiga',
        start: null,
        country: 'ES',
    },
    via: [
        {
            name: 'DAZN LaLiga',
            channel: { streamId: 70, categoryId: '9', title: '', icon: null },
        },
    ],
} as SportMatch;

describe('CountryTvListings', () => {
    let listings: CountryTvListings;
    const programmes = new Map<number, TvProgramme>();
    const live = signal(true);

    beforeEach(() => {
        programmes.clear();
        live.set(true);
        TestBed.configureTestingModule({
            providers: [
                CountryTvListings,
                {
                    provide: SportsCatalogService,
                    useValue: {
                        today: signal([LALIGA_MATCH]),
                        isLive: () => live(),
                    },
                },
                {
                    provide: CountryTvGuide,
                    useValue: {
                        nowOn: (streamIds: readonly number[]) =>
                            streamIds
                                .map((id) => programmes.get(id))
                                .find(Boolean) ?? null,
                    },
                },
            ],
        });
        listings = TestBed.inject(CountryTvListings);
    });

    it('says the match a competition’s channel carries, on any copy', () => {
        expect(listings.nowOn(channel('DAZN LaLiga', 71, 70))).toEqual({
            title: 'LaLiga · Real Madrid – Sevilla',
            progress: null,
            football: true,
        });
        live.set(false);
        expect(listings.nowOn(channel('DAZN LaLiga', 70))).toBeNull();
    });

    it('prefers the guide’s programme, football by its name or its match', () => {
        programmes.set(10, {
            title: 'Telediario 2',
            time: '21:00 – 22:00',
            progress: 30,
        });
        programmes.set(11, {
            title: 'Fútbol: Primera División',
            time: '21:00 – 23:00',
            progress: 10,
        });
        programmes.set(70, {
            title: 'En directo',
            time: '21:00 – 23:00',
            progress: 50,
        });
        expect(listings.nowOn(channel('La 1', 10))).toEqual({
            title: 'Telediario 2',
            progress: 30,
            football: false,
        });
        expect(listings.nowOn(channel('Gol', 11))?.football).toBe(true);
        expect(listings.nowOn(channel('DAZN LaLiga', 70))).toEqual({
            title: 'En directo',
            progress: 50,
            football: true,
        });
    });

    it('knows nothing of a channel neither knows', () => {
        expect(listings.nowOn(channel('Cuatro', 40))).toBeNull();
    });
});
