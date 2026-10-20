import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
    playRequest,
    playRequestMatch,
    SportsBoardService,
} from './sports-board.service';
import { buildSportsCatalog, type SportMatch } from './sports-catalog';
import { SportsCatalogService } from './sports-catalog.service';

const CATALOG = buildSportsCatalog(
    [{ category_id: 1, category_name: '|ES| ✪ LALIGA PPV' }],
    [
        {
            stream_id: 1,
            category_id: 1,
            name: 'Live | Getafe CF - Real Madrid | LaLiga | ES',
        },
        {
            stream_id: 2,
            category_id: 1,
            name: 'Live | Sevilla FC - Real Betis | LaLiga | ES',
        },
        {
            stream_id: 3,
            category_id: 1,
            name: 'Live | Leeds United - Manchester United | Premier League | ES',
        },
    ]
);

describe('SportsBoardService', () => {
    let board: SportsBoardService;
    const navigate = jest.fn(async () => true);

    beforeEach(() => {
        navigate.mockClear();
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: SportsCatalogService,
                    useValue: {
                        catalog: signal(CATALOG),
                        now: signal(new Date()),
                        isLive: (match: SportMatch) =>
                            match.event.status === 'live',
                        upcoming: (matches: SportMatch[]) => matches,
                    },
                },
                { provide: Router, useValue: { navigate } },
            ],
        });
        board = TestBed.inject(SportsBoardService);
    });

    it('counts the matches on now by competition', () => {
        expect(board.liveCounts().get('laliga')).toBe(2);
        expect(board.liveCounts().get('premier-league')).toBe(1);
        expect(board.liveCounts().has('serie-a')).toBe(false);
    });

    it('gives each followed team its match', () => {
        expect(
            board.teams().map((fixture) => fixture.match?.streamId ?? null)
        ).toEqual([1, null, null]);
    });

    it('opens a match on its competition’s page, asking it to play and to list its signals', () => {
        const match = CATALOG.laliga.matches.find(
            (entry) => entry.streamId === 2
        ) as SportMatch;
        board.openMatch(match);

        expect(navigate).toHaveBeenCalledWith(
            ['/workspace', 'sports', 'laliga'],
            {
                state: {
                    tiagotvSportsPlay: {
                        streamId: 2,
                        categoryId: '1',
                        title: 'Sevilla FC - Real Betis',
                        icon: null,
                    },
                    tiagotvSportsMatch: match.key,
                },
            }
        );
        const state = (navigate.mock.calls[0] as unknown[])[1] as {
            state: unknown;
        };
        expect(playRequest(state.state)?.streamId).toBe(2);
        expect(playRequestMatch(state.state)).toBe(match.key);
    });

    it('reads only a well-formed request from the navigation', () => {
        expect(playRequestMatch(null)).toBeNull();
        expect(playRequestMatch({ tiagotvSportsMatch: 3 })).toBeNull();
        expect(playRequest(null)).toBeNull();
        expect(playRequest({})).toBeNull();
        expect(
            playRequest({ tiagotvSportsPlay: { streamId: '2', title: 'x' } })
        ).toBeNull();
    });
});
