import {
    type VideoJsPlayer,
    getVideoJsTechVideo,
    hasVideoJsTech,
} from './vjs-player.types';
import * as playerTypes from './vjs-player.types';

describe('getVideoJsTechVideo', () => {
    it('reads safe codecs from the public VHS representations API', () => {
        const read = (
            playerTypes as unknown as {
                getVideoJsPlaybackCodecs: (player: unknown) => unknown;
            }
        ).getVideoJsPlaybackCodecs;
        expect(read).toBeDefined();
        expect(
            read({
                tech: () => ({
                    vhs: {
                        representations: () => [
                            {
                                codecs: {
                                    video: 'avc1.64001e',
                                    audio: 'mp4a.40.2',
                                },
                                uri: 'secret-url',
                            },
                            {
                                codecs: {
                                    video: 'https://secret.test',
                                    audio: 'secret',
                                },
                            },
                        ],
                    },
                }),
            })
        ).toEqual({ videoCodecs: ['avc1.64001e'], audioCodecs: ['mp4a.40.2'] });
        expect(
            read({
                tech: () => {
                    throw new Error('disposed');
                },
            })
        ).toEqual({ videoCodecs: [], audioCodecs: [] });
    });
    it('returns the current Video.js Tech video element', () => {
        const video = document.createElement('video');
        const tech = jest.fn(() => ({ el: () => video }));

        expect(getVideoJsTechVideo({ tech } as unknown as VideoJsPlayer)).toBe(
            video
        );
        expect(tech).toHaveBeenCalledWith({
            IWillNotUseThisInPlugins: true,
        });
    });

    it('rejects non-video Tech elements and transient access failures', () => {
        expect(
            getVideoJsTechVideo({
                tech: () => ({ el: () => document.createElement('div') }),
            } as unknown as VideoJsPlayer)
        ).toBeNull();
        expect(
            getVideoJsTechVideo({
                tech: () => {
                    throw new Error('Tech unavailable');
                },
            } as unknown as VideoJsPlayer)
        ).toBeNull();
    });
});

describe('hasActiveVhsSourceHandler', () => {
    it('detects the documented Video.js Tech VHS runtime property', () => {
        const tech = jest.fn(() => ({ vhs: {} }));

        expect(
            hasActiveVhsSourceHandler({
                tech,
            } as unknown as VideoJsPlayer)
        ).toBe(true);
        expect(tech).toHaveBeenCalledWith({
            IWillNotUseThisInPlugins: true,
        });
        expect(
            hasActiveVhsSourceHandler({
                tech: () => ({ el: () => document.createElement('video') }),
            } as unknown as VideoJsPlayer)
        ).toBe(false);
    });

    it('fails closed when Tech access is transiently unavailable', () => {
        expect(
            hasActiveVhsSourceHandler({
                tech: () => {
                    throw new Error('Tech unavailable');
                },
            } as unknown as VideoJsPlayer)
        ).toBe(false);
    });
});

describe('hasVideoJsTech', () => {
    it('is false until Video.js has loaded a tech for the source', () => {
        const withTech = (tech: () => unknown) =>
            hasVideoJsTech({ tech } as unknown as VideoJsPlayer);

        expect(withTech(() => ({ el: () => null }))).toBe(true);
        // `tech_` is unset before the first load and when no tech accepted
        // the source, and `false` while unloading one.
        expect(withTech(() => undefined)).toBe(false);
        expect(withTech(() => false)).toBe(false);
        expect(
            withTech(() => {
                throw new Error('disposed');
            })
        ).toBe(false);
    });
});

function hasActiveVhsSourceHandler(player: VideoJsPlayer): boolean {
    const helper = (
        playerTypes as unknown as {
            readonly hasActiveVhsSourceHandler?: (
                candidate: VideoJsPlayer
            ) => boolean;
        }
    ).hasActiveVhsSourceHandler;

    expect(helper).toBeDefined();
    if (!helper) {
        throw new Error('hasActiveVhsSourceHandler is not exported');
    }
    return helper(player);
}
