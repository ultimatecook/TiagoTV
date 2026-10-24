import type { UnifiedCollectionItem } from '../collection/unified-collection-item.interface';
import {
    buildLiveChannelPlayTarget,
    buildLiveChannelPlayTargetFor,
    clearLiveChannelPlayRequest,
    LIVE_CHANNEL_PLAY_STATE_KEY,
    readLiveChannelPlayRequest,
} from './live-channel-play-request';

const CHANNEL: UnifiedCollectionItem = {
    uid: 'xtream::source-1::live::14',
    name: '|ES| 24h',
    contentType: 'live',
    sourceType: 'xtream',
    playlistId: 'source-1',
    playlistName: 'TiagoTV',
    logo: 'http://logo.test/24h.png',
    xtreamId: 14,
    categoryId: 4,
};

describe('live channel play request', () => {
    afterEach(() => history.replaceState(null, ''));

    it('sends an Xtream channel to "En vivo", with what plays it', () => {
        const target = buildLiveChannelPlayTarget(CHANNEL);

        expect(target?.link).toEqual(['/workspace', 'countries']);
        expect(readLiveChannelPlayRequest(target?.state)).toEqual({
            playlistId: 'source-1',
            streamId: 14,
            categoryId: '4',
            title: '|ES| 24h',
            icon: 'http://logo.test/24h.png',
        });
    });

    it('leaves other items to their own way in', () => {
        expect(
            buildLiveChannelPlayTarget({ ...CHANNEL, sourceType: 'm3u' })
        ).toBeNull();
        expect(
            buildLiveChannelPlayTarget({ ...CHANNEL, contentType: 'movie' })
        ).toBeNull();
        expect(
            buildLiveChannelPlayTarget({ ...CHANNEL, xtreamId: undefined })
        ).toBeNull();
    });

    it('sends a stored Xtream row (a recent, a favourite, a hit) the same way', () => {
        const target = buildLiveChannelPlayTargetFor({
            sourceType: 'xtream',
            playlistId: 'source-1',
            streamId: '14',
            categoryId: '',
            title: '|ES| 24h',
            icon: '',
        });

        expect(target?.link).toEqual(['/workspace', 'countries']);
        expect(readLiveChannelPlayRequest(target?.state)).toEqual({
            playlistId: 'source-1',
            streamId: 14,
            categoryId: null,
            title: '|ES| 24h',
            icon: null,
        });
    });

    it('asks nothing for a channel En vivo cannot show', () => {
        const channel = {
            sourceType: 'xtream',
            playlistId: 'source-1',
            streamId: 14,
            title: 'x',
        };
        expect(
            buildLiveChannelPlayTargetFor({ ...channel, sourceType: 'stalker' })
        ).toBeNull();
        expect(
            buildLiveChannelPlayTargetFor({ ...channel, sourceType: undefined })
        ).toBeNull();
        expect(
            buildLiveChannelPlayTargetFor({ ...channel, playlistId: '' })
        ).toBeNull();
        expect(
            buildLiveChannelPlayTargetFor({ ...channel, streamId: '' })
        ).toBeNull();
        expect(
            buildLiveChannelPlayTargetFor({ ...channel, streamId: 'abc' })
        ).toBeNull();
    });

    it('reads no request from a state without a usable one', () => {
        expect(readLiveChannelPlayRequest(null)).toBeNull();
        expect(readLiveChannelPlayRequest({ other: 1 })).toBeNull();
        expect(
            readLiveChannelPlayRequest({
                [LIVE_CHANNEL_PLAY_STATE_KEY]: { playlistId: 'a', streamId: 0 },
            })
        ).toBeNull();
        expect(
            readLiveChannelPlayRequest({
                [LIVE_CHANNEL_PLAY_STATE_KEY]: { playlistId: 'a', streamId: 3 },
            })
        ).toEqual({
            playlistId: 'a',
            streamId: 3,
            categoryId: null,
            title: '',
            icon: null,
        });
    });

    it('takes the request off the history entry, keeping the rest', () => {
        history.replaceState(
            { navigationId: 2, [LIVE_CHANNEL_PLAY_STATE_KEY]: { streamId: 1 } },
            ''
        );

        clearLiveChannelPlayRequest();

        expect(history.state).toEqual({ navigationId: 2 });
    });
});
