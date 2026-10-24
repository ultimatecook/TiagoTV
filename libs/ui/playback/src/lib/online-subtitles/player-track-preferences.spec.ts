import type {
    PlayerController,
    PlayerControlsState,
    PlayerTrack,
} from '../player-controls/player-controls.model';
import { createEmptyControlsState } from '../player-controls/player-controls-defaults';
import { PlayerTrackPreferences } from './player-track-preferences';

function controller(overrides: Partial<PlayerController> = {}) {
    const commands = {
        setAudioTrack: jest.fn(),
        setSubtitleTrack: jest.fn(),
    };
    return {
        controller: { commands, ...overrides } as unknown as PlayerController,
        commands,
    };
}

const state = (
    audioTracks: PlayerTrack[],
    subtitleTracks: PlayerTrack[] = [],
    extra: Partial<PlayerControlsState> = {}
): PlayerControlsState => ({
    ...createEmptyControlsState(),
    audioTracks,
    subtitleTracks,
    ...extra,
});

const spanishAudio = {
    id: 1,
    label: 'Español',
    selected: true,
    language: 'spa',
};
const englishAudio = {
    id: 2,
    label: 'English',
    selected: false,
    language: 'eng',
};
const spanishSubs = {
    id: 7,
    label: 'Español',
    selected: false,
    language: 'spa',
};

describe('PlayerTrackPreferences', () => {
    it('switches a dual-audio file to the original track with Spanish subtitles, once', () => {
        const preferences = new PlayerTrackPreferences();
        const { controller: player, commands } = controller();

        preferences.apply(
            player,
            state([spanishAudio, englishAudio]),
            'p1:vod:13',
            'original'
        );
        preferences.apply(
            player,
            state([spanishAudio, englishAudio], [spanishSubs]),
            'p1:vod:13',
            'original'
        );
        // The user picks Spanish audio back: the app does not insist.
        preferences.apply(
            player,
            state([{ ...spanishAudio }, { ...englishAudio }], [spanishSubs]),
            'p1:vod:13',
            'original'
        );

        expect(commands.setAudioTrack.mock.calls).toEqual([[2]]);
        expect(commands.setSubtitleTrack.mock.calls).toEqual([[7]]);
    });

    it('applies again for the next title', () => {
        const preferences = new PlayerTrackPreferences();
        const { controller: player, commands } = controller();

        preferences.apply(
            player,
            state([spanishAudio, englishAudio]),
            'a',
            'original'
        );
        preferences.apply(
            player,
            state([spanishAudio, englishAudio]),
            'b',
            'original'
        );

        expect(commands.setAudioTrack).toHaveBeenCalledTimes(2);
    });

    it('keeps the Spanish dub and turns full subtitles off with "Español"', () => {
        const preferences = new PlayerTrackPreferences();
        const { controller: player, commands } = controller();

        preferences.apply(
            player,
            state(
                [spanishAudio, englishAudio],
                [{ ...spanishSubs, selected: true }]
            ),
            'k',
            'es'
        );

        expect(commands.setAudioTrack).not.toHaveBeenCalled();
        expect(commands.setSubtitleTrack).toHaveBeenCalledWith(-1);
    });

    it('leaves Embedded MPV (alang/slang) and live TV alone', () => {
        const preferences = new PlayerTrackPreferences();
        const mpv = controller({ selectsLanguageTracks: true });
        const web = controller();

        preferences.apply(
            mpv.controller,
            state([spanishAudio, englishAudio]),
            'k',
            'original'
        );
        preferences.apply(
            web.controller,
            state([spanishAudio, englishAudio], [], { isLive: true }),
            'k',
            'original'
        );

        expect(mpv.commands.setAudioTrack).not.toHaveBeenCalled();
        expect(web.commands.setAudioTrack).not.toHaveBeenCalled();
    });
});
