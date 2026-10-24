import {
    DEFAULT_PLAYER_CAPABILITIES,
    createEmptyControlsState,
} from './player-controls-defaults';
import { getSettingsGroupAvailability } from './controls-settings-groups';

describe('settings group availability', () => {
    it('keeps the subtitles group for "Search OpenSubtitles…" with no track', () => {
        const state = createEmptyControlsState();

        expect(
            getSettingsGroupAvailability(DEFAULT_PLAYER_CAPABILITIES, state)
                .subtitles
        ).toBe(false);
        expect(
            getSettingsGroupAvailability(
                DEFAULT_PLAYER_CAPABILITIES,
                state,
                true
            ).subtitles
        ).toBe(true);
    });
});
