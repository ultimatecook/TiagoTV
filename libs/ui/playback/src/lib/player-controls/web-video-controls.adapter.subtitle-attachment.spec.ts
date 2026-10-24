import { activePlayerController } from '../online-subtitles/active-player';
import { WebVideoControlsAdapter } from './web-video-controls.adapter';

describe('WebVideoControlsAdapter subtitle attachment', () => {
    const file = {
        name: 'Español · OpenSubtitles',
        format: 'vtt' as const,
        content: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola\n',
        language: 'es',
    };

    it('is the active player while attached', () => {
        const adapter = new WebVideoControlsAdapter();
        adapter.attach(document.createElement('video'));

        expect(activePlayerController()).toBe(adapter);
        adapter.detach();
        expect(activePlayerController()).not.toBe(adapter);
    });

    it('attaches a downloaded subtitle through the engine and refreshes', async () => {
        const adapter = new WebVideoControlsAdapter();
        const attachExternalSubtitle = jest.fn().mockReturnValue(true);
        adapter.attach(document.createElement('video'), {
            attachExternalSubtitle,
        });

        expect(adapter.subtitleAttachment.canAttach()).toBe(true);
        await expect(adapter.subtitleAttachment.attach(file)).resolves.toBe(
            true
        );
        expect(attachExternalSubtitle).toHaveBeenCalledWith(file);
        adapter.detach();
    });

    it('cannot attach to an engine without the hook', async () => {
        const adapter = new WebVideoControlsAdapter();
        adapter.attach(document.createElement('video'));

        expect(adapter.subtitleAttachment.canAttach()).toBe(false);
        await expect(adapter.subtitleAttachment.attach(file)).resolves.toBe(
            false
        );
        adapter.detach();
    });
});
