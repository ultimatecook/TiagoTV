import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SeriesQuickStartAction } from '@iptvnator/portal/shared/util';
import { XtreamStore } from '@iptvnator/portal/xtream/data-access';
import type { XtreamSerieEpisode } from '@iptvnator/shared/interfaces';
import type { XtreamSerieDetailsView } from './serial-details-playback.service';
import { SERIES_SEASON_STATE_KEY } from './serial-details-season-memory';
import { SerialDetailsSeasonsService } from './serial-details-seasons.service';

describe('SerialDetailsSeasonsService', () => {
    const pendingSeasons = new Set<string>();
    const store = {
        isTmdbEpisodeMetadataPending: jest.fn((seasonKey: string) =>
            pendingSeasons.has(seasonKey)
        ),
        enrichSelectedSerialSeason: jest.fn(),
        currentPlaylist: signal({ id: 'playlist-1' }),
    };
    const item = signal<XtreamSerieDetailsView | null>({
        info: { tmdb_id: 777 },
        episodes: { '1': [], '2': [] },
    } as unknown as XtreamSerieDetailsView);
    let service: SerialDetailsSeasonsService;

    afterEach(() => window.history.replaceState({}, document.title));

    beforeEach(() => {
        pendingSeasons.clear();
        store.enrichSelectedSerialSeason.mockClear();
        TestBed.configureTestingModule({
            providers: [
                SerialDetailsSeasonsService,
                { provide: XtreamStore, useValue: store },
            ],
        });
        service = TestBed.inject(SerialDetailsSeasonsService);
    });

    it('follows the detail container, not the fullscreen picker, for metadata loading', () => {
        // Season 2's enrichment is outstanding; the detail container shows
        // season 1, which has settled.
        pendingSeasons.add('2');
        const detailSeasonKey = signal<string | null>('1');
        service.bind({ selectedItem: item, detailSeasonKey });
        expect(service.metadataLoading()).toBe(false);

        // The fullscreen picker chooses season 2: it gets enriched, but the
        // detail rows of season 1 must stay.
        service.select('2');
        TestBed.flushEffects();
        expect(store.enrichSelectedSerialSeason).toHaveBeenCalledWith('2');
        expect(service.metadataLoading()).toBe(false);

        // Only once the container itself moves to season 2 is it loading.
        detailSeasonKey.set('2');
        expect(service.metadataLoading()).toBe(true);
    });

    it('stands in with the lowest season before the container reports one', () => {
        pendingSeasons.add('1');
        service.bind({ selectedItem: item });
        expect(service.metadataLoading()).toBe(true);

        pendingSeasons.delete('1');
        pendingSeasons.add('2');
        service.bind({ selectedItem: item });
        expect(service.metadataLoading()).toBe(false);
    });

    describe('the season the list opens on', () => {
        const episode = (id: number, season: number) =>
            ({ id: String(id), season, episode_num: 1 }) as XtreamSerieEpisode;
        const series = signal({
            series_id: 70,
            info: {},
            episodes: {
                '1': [episode(701, 1)],
                '2': [episode(702, 2)],
                '3': [episode(731, 3), episode(732, 3)],
            },
        } as unknown as XtreamSerieDetailsView);
        // "Play S03E02": started seconds ago, not yet in progress.
        const quickStart = signal({
            episode: episode(732, 3),
        } as SeriesQuickStartAction);

        it("is the play button's episode's on a new visit", () => {
            service.bind({ selectedItem: series, quickStart });
            TestBed.flushEffects();

            expect(service.preferredSeason()).toBe('3');
        });

        it('is the season shown when the history entry was left', () => {
            window.history.replaceState(
                {
                    [SERIES_SEASON_STATE_KEY]: {
                        playlistId: 'playlist-1',
                        seriesId: 70,
                        seasonKey: '2',
                    },
                },
                document.title
            );
            service.bind({ selectedItem: series, quickStart });
            TestBed.flushEffects();

            expect(service.preferredSeason()).toBe('2');
        });

        it('keeps the season on screen on the history entry', () => {
            const detailSeasonKey = signal<string | null>('1');
            service.bind({ selectedItem: series, detailSeasonKey, quickStart });
            TestBed.flushEffects();
            detailSeasonKey.set('2');
            TestBed.flushEffects();

            expect(window.history.state[SERIES_SEASON_STATE_KEY]).toEqual({
                playlistId: 'playlist-1',
                seriesId: 70,
                seasonKey: '2',
            });
            // What this visit wrote does not change where it opened.
            expect(service.preferredSeason()).toBe('3');
        });
    });
});
