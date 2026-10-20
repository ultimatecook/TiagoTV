import {
    clearCollectionDetailSeriesResume,
    clearDetailPlayRequest,
    DETAIL_PLAY_REQUEST_STATE_KEY,
    readDetailPlayRequest,
    withDetailPlayRequest,
} from './detail-play-request';
import { OPEN_COLLECTION_DETAIL_STATE_KEY } from './workspace-portal-navigation';

describe('detail play request', () => {
    afterEach(() => window.history.replaceState(null, ''));

    it('adds the request to a target, keeping its state', () => {
        const target = withDetailPlayRequest(
            { link: ['/workspace', 'global-recent'], state: { open: 1 } },
            { mode: 'resume', contentId: 66 }
        );

        expect(target).toEqual({
            link: ['/workspace', 'global-recent'],
            state: {
                open: 1,
                [DETAIL_PLAY_REQUEST_STATE_KEY]: {
                    mode: 'resume',
                    contentId: 66,
                },
            },
        });
        expect(readDetailPlayRequest(target.state)).toEqual({
            mode: 'resume',
            contentId: 66,
        });
    });

    it('reads nothing from a missing or malformed request', () => {
        const read = (request: unknown) =>
            readDetailPlayRequest({ [DETAIL_PLAY_REQUEST_STATE_KEY]: request });

        expect(readDetailPlayRequest(null)).toBeNull();
        expect(readDetailPlayRequest({})).toBeNull();
        expect(read({ mode: 'shuffle', contentId: 1 })).toBeNull();
        expect(read({ mode: 'resume', contentId: 0 })).toBeNull();
        expect(read({ mode: 'resume', contentId: 'x' })).toBeNull();
        expect(read({ mode: 'first-episode', contentId: '12' })).toEqual({
            mode: 'first-episode',
            contentId: 12,
        });
    });

    it('takes the request off the current history entry only', () => {
        window.history.replaceState(
            {
                keep: true,
                [DETAIL_PLAY_REQUEST_STATE_KEY]: {
                    mode: 'resume',
                    contentId: 5,
                },
            },
            ''
        );

        clearDetailPlayRequest();

        expect(window.history.state).toEqual({ keep: true });
    });

    it('takes a series resume off the entry, keeping its inline detail', () => {
        const item = { uid: 'xtream::p::series:9', name: 'S' };
        window.history.replaceState(
            {
                keep: true,
                [OPEN_COLLECTION_DETAIL_STATE_KEY]: {
                    item,
                    seriesResume: {
                        seriesXtreamId: 9,
                        contentXtreamId: 92,
                        seasonNumber: 1,
                        episodeNumber: 2,
                    },
                },
            },
            ''
        );

        clearCollectionDetailSeriesResume();

        expect(window.history.state).toEqual({
            keep: true,
            [OPEN_COLLECTION_DETAIL_STATE_KEY]: { item },
        });
        // Nothing to take: the entry stays as it is.
        const before = window.history.state;
        clearCollectionDetailSeriesResume();
        expect(window.history.state).toBe(before);
    });
});
