import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DETAIL_PLAY_REQUEST_STATE_KEY } from '@iptvnator/portal/shared/util';
import type { PlaybackPositionData } from '@iptvnator/shared/interfaces';
import { SerialDetailsComponent } from './serial-details.component';
import {
    configureSerialDetailsTestBed,
    createSerialDetailsStubs,
    resetSerialDetailsStubs,
} from './serial-details.harness';

/** Saved progress on an episode of the harness's series (103). */
function position(
    contentXtreamId: number,
    seasonNumber: number,
    episodeNumber: number,
    positionSeconds: number
): PlaybackPositionData {
    return {
        contentXtreamId,
        contentType: 'episode',
        seriesXtreamId: 103,
        seasonNumber,
        episodeNumber,
        positionSeconds,
        durationSeconds: 1200,
        playlistId: 'xtream-1',
        updatedAt: '2026-05-10T12:00:00.000Z',
    };
}

/**
 * "Empezar T1·E1" on the Home and Series' "Reproducir" land on the series
 * page with a play request: it starts an episode by itself.
 */
describe('SerialDetailsComponent — play request', () => {
    let fixture: ComponentFixture<SerialDetailsComponent>;
    const stubs = createSerialDetailsStubs();

    async function open(mode: string, contentId = 103): Promise<void> {
        window.history.replaceState(
            { [DETAIL_PLAY_REQUEST_STATE_KEY]: { mode, contentId } },
            ''
        );
        fixture = TestBed.createComponent(SerialDetailsComponent);
        for (let round = 0; round < 3; round++) {
            fixture.detectChanges();
            await fixture.whenStable();
        }
    }

    /** The episode id each start played, in order. */
    const played = () =>
        stubs.constructEpisodeStreamUrl.mock.calls.map(([episode]) =>
            String(episode.id)
        );

    beforeEach(async () => {
        resetSerialDetailsStubs(stubs);
        await configureSerialDetailsTestBed(stubs);
    });

    afterEach(() => {
        window.history.replaceState({}, '', window.location.href);
        fixture?.destroy();
    });

    it('starts the first episode, even part-way through the series', async () => {
        stubs.getSeriesPlaybackPositions.mockResolvedValue([
            position(2001, 2, 1, 300),
        ]);
        await open('first-episode');

        expect(played()).toEqual(['1001']);
        // Taken off the entry: Back onto it does not play again.
        expect(window.history.state).toEqual({});
    });

    it('plays the episode the page goes on with on "resume"', async () => {
        stubs.getSeriesPlaybackPositions.mockResolvedValue([
            position(2001, 2, 1, 300),
        ]);
        await open('resume');

        expect(played()).toEqual(['2001']);
        expect(stubs.openResolvedPlayback).toHaveBeenCalledWith(
            expect.objectContaining({ startTime: 300 }),
            true
        );
    });

    it('waits for the saved positions, and ignores another series’ request', async () => {
        stubs.getSeriesPlaybackPositions.mockReturnValue(
            new Promise(() => undefined)
        );
        await open('first-episode');
        expect(played()).toEqual([]);

        fixture.destroy();
        stubs.getSeriesPlaybackPositions.mockResolvedValue([]);
        await open('first-episode', 999);
        expect(played()).toEqual([]);
    });
});
