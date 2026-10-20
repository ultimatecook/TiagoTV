import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DETAIL_PLAY_REQUEST_STATE_KEY } from '@iptvnator/portal/shared/util';
import { XtreamVodDetails } from '@iptvnator/shared/interfaces';
import { VodDetailsRouteComponent } from './vod-details-route.component';
import {
    configureVodDetailsRouteTestBed,
    createVodDetailsRouteStubs,
    resetVodDetailsRouteStubs,
    silenceRouteLogging,
} from './vod-details-route.harness';

/**
 * A "play" button elsewhere (the Home's Continue, Series / Películas'
 * Play) lands here with a play request: the movie starts by itself, from
 * where it was left.
 */
describe('VodDetailsRouteComponent — play request', () => {
    let fixture: ComponentFixture<VodDetailsRouteComponent>;
    let restoreLogging: (() => void) | undefined;
    const stubs = createVodDetailsRouteStubs();
    const movie = {
        info: { name: 'Movie A', description: 'Movie A details' },
        movie_data: {
            stream_id: 650020,
            name: 'Movie A',
            container_extension: 'mp4',
        },
    } as XtreamVodDetails;

    async function open(state: unknown): Promise<void> {
        history.replaceState(state, '');
        fixture = TestBed.createComponent(VodDetailsRouteComponent);
        stubs.currentPlaylist.set({ id: 'playlist-1' });
        stubs.selectedItem.set(movie);
        for (let round = 0; round < 4; round++) {
            fixture.detectChanges();
            await fixture.whenStable();
        }
    }

    beforeEach(async () => {
        restoreLogging = silenceRouteLogging();
        resetVodDetailsRouteStubs(stubs);
        // The external path: the inline player is not rendered here.
        stubs.isEmbeddedPlayer.mockReturnValue(false);
        stubs.openResolvedPlayback.mockResolvedValue(undefined);
        stubs.getPlaybackPosition.mockResolvedValue({
            playlistId: 'playlist-1',
            contentXtreamId: 650020,
            contentType: 'vod',
            positionSeconds: 1200,
            durationSeconds: 7200,
        });
        await configureVodDetailsRouteTestBed(stubs);
    });

    afterEach(() => {
        history.replaceState(null, '');
        restoreLogging?.();
    });

    it('resumes the movie where it was left, once', async () => {
        await open({
            [DETAIL_PLAY_REQUEST_STATE_KEY]: {
                mode: 'resume',
                contentId: 650020,
            },
        });

        expect(stubs.openResolvedPlayback).toHaveBeenCalledTimes(1);
        expect(stubs.openResolvedPlayback.mock.calls[0][0]).toEqual(
            expect.objectContaining({ startTime: 1200 })
        );
        // Taken off the entry: Back onto it does not play again.
        expect(history.state).toEqual({});
    });

    it('stays on the page without a request, or with one for another title', async () => {
        await open({
            [DETAIL_PLAY_REQUEST_STATE_KEY]: {
                mode: 'resume',
                contentId: 777,
            },
        });
        expect(stubs.openResolvedPlayback).not.toHaveBeenCalled();

        fixture.destroy();
        await open(null);
        expect(stubs.openResolvedPlayback).not.toHaveBeenCalled();
    });
});
