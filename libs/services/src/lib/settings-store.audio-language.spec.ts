import { Injector } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import { of } from 'rxjs';
import {
    DEFAULT_OPEN_SUBTITLES_SETTINGS,
    embeddedMpvAudioLanguageOptions,
    Settings,
    STORE_KEY,
} from '@iptvnator/shared/interfaces';
import { EpgSourceSettingsService } from './epg-source-settings.service';
import { SettingsStore } from './settings-store.service';

describe('SettingsStore audio language and OpenSubtitles', () => {
    const testWindow = window as unknown as {
        electron?: { platform: string; updateSettings: jest.Mock };
    };
    const originalElectron = testWindow.electron;
    let storedSettings: Partial<Settings> | null;
    let storage: { get: jest.Mock; set: jest.Mock };
    let updateSettings: jest.Mock;

    async function load(): Promise<InstanceType<typeof SettingsStore>> {
        const injector = Injector.create({
            providers: [
                SettingsStore,
                EpgSourceSettingsService,
                { provide: StorageMap, useValue: storage },
            ],
        });
        jest.spyOn(
            injector.get(EpgSourceSettingsService),
            'synchronize'
        ).mockResolvedValue(undefined);
        const store = injector.get(SettingsStore);
        await store.loadSettings();
        return store;
    }

    function mirroredLines(): string[] {
        const calls = updateSettings.mock.calls;
        return String(calls[calls.length - 1][0].embeddedMpvExtraOptions).split(
            '\n'
        );
    }

    beforeEach(() => {
        storedSettings = null;
        storage = {
            get: jest.fn(() => of(storedSettings)),
            set: jest.fn(() => of(undefined)),
        };
        updateSettings = jest.fn().mockResolvedValue(undefined);
        testWindow.electron = { platform: 'darwin', updateSettings };
    });

    afterEach(() => {
        testWindow.electron = originalElectron;
        jest.restoreAllMocks();
    });

    it('gives existing users original audio: settings saved before the choice', async () => {
        storedSettings = { playbackSmoothness: 'normal', showCaptions: false };

        const store = await load();

        expect(store.getSettings().audioLanguage).toBe('original');
        expect(store.getSettings().openSubtitles).toEqual(
            DEFAULT_OPEN_SUBTITLES_SETTINGS
        );
        // Embedded MPV gets the original-audio track choice with no new installer.
        expect(mirroredLines()).toEqual([
            ...embeddedMpvAudioLanguageOptions('original'),
        ]);
        expect(mirroredLines()[0]).toMatch(/^alang=en,eng,/);
    });

    it('restores and mirrors a saved Spanish dub', async () => {
        storedSettings = { audioLanguage: 'es', playbackSmoothness: 'normal' };

        const store = await load();

        expect(store.audioLanguage?.()).toBe('es');
        expect(mirroredLines()[0]).toMatch(/^alang=es,spa,es-419/);
    });

    it("lets the user's own alang line win", async () => {
        storedSettings = {
            embeddedMpvExtraOptions: 'alang=jpn',
            playbackSmoothness: 'normal',
        };

        await load();

        expect(
            mirroredLines().filter((line) => line.startsWith('alang='))
        ).toEqual(['alang=jpn']);
        expect(mirroredLines()).toContain('subs-with-matching-audio=forced');
    });

    it('normalizes a stored or updated unknown value to original', async () => {
        storedSettings = {
            audioLanguage: 'klingon' as Settings['audioLanguage'],
        };
        const store = await load();
        expect(store.audioLanguage?.()).toBe('original');

        await store.updateSettings({ audioLanguage: 'es' });
        expect(storage.set).toHaveBeenLastCalledWith(
            STORE_KEY.Settings,
            expect.objectContaining({ audioLanguage: 'es' })
        );
    });

    it('keeps the OpenSubtitles account in the renderer, normalized', async () => {
        const store = await load();

        await store.updateSettings({
            openSubtitles: {
                ...DEFAULT_OPEN_SUBTITLES_SETTINGS,
                apiKey: ' key-123 ',
                username: 'tiago',
                password: 'secret-pass',
                secondLanguage: 'es',
            },
        });

        expect(store.getSettings().openSubtitles).toEqual(
            expect.objectContaining({
                apiKey: 'key-123',
                username: 'tiago',
                password: 'secret-pass',
                secondLanguage: '',
            })
        );
        // The main-process mirror never carries the account.
        for (const [payload] of updateSettings.mock.calls) {
            expect(JSON.stringify(payload)).not.toContain('secret-pass');
            expect(payload).not.toHaveProperty('openSubtitles');
        }
    });
});
