import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LazySnackBar, SettingsStore } from '@iptvnator/services';
import { VideoPlayer } from '@iptvnator/shared/interfaces';
import { VodEmbeddedMpvAvailability } from '../web-player-view/vod-embedded-mpv';
import { PlayerChoiceService } from './player-choice.service';

describe('PlayerChoiceService', () => {
    const player = signal<VideoPlayer>(VideoPlayer.VideoJs);
    const updateSettings = jest.fn(async (patch: { player: VideoPlayer }) => {
        player.set(patch.player);
    });
    const open = jest.fn(async () => null);
    let service: PlayerChoiceService;

    beforeEach(() => {
        player.set(VideoPlayer.VideoJs);
        updateSettings.mockClear();
        open.mockClear();
        TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot()],
            providers: [
                {
                    provide: SettingsStore,
                    useValue: { player, updateSettings },
                },
                { provide: LazySnackBar, useValue: { open } },
                {
                    provide: VodEmbeddedMpvAvailability,
                    useValue: { available: signal(true) },
                },
            ],
        });
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('es', {
            PLAYBACK_DIAGNOSTICS: {
                PLAYER_SAVED: '{{player}} será tu reproductor',
                EMBEDDED_MPV_NAME: 'MPV integrado',
            },
        });
        translate.use('es');
        service = TestBed.inject(PlayerChoiceService);
    });

    it('saves Embedded MPV as the default player and says so', async () => {
        await service.remember('embedded-mpv');

        expect(updateSettings).toHaveBeenCalledWith({
            player: VideoPlayer.EmbeddedMpv,
        });
        expect(open).toHaveBeenCalledWith(
            'MPV integrado será tu reproductor',
            undefined,
            { duration: 3500 }
        );
    });

    it('saves an external or web player the same way', async () => {
        await service.remember('vlc');
        expect(updateSettings).toHaveBeenLastCalledWith({
            player: VideoPlayer.VLC,
        });
        await service.remember('html5');
        expect(updateSettings).toHaveBeenLastCalledWith({
            player: VideoPlayer.Html5Player,
        });
        expect(open).toHaveBeenLastCalledWith(
            'HTML5 será tu reproductor',
            undefined,
            { duration: 3500 }
        );
    });

    it('does not rewrite a setting that already holds the player', async () => {
        await service.remember('videojs');
        expect(updateSettings).not.toHaveBeenCalled();
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('knows whether this machine has Embedded MPV', () => {
        expect(service.embeddedMpvAvailable()).toBe(true);
    });
});
