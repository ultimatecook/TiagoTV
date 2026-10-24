import { Injector } from '@angular/core';
import { StorageMap } from '@ngx-pwa/local-storage';
import { of } from 'rxjs';
import {
    EMBEDDED_MPV_STABLE_OPTIONS,
    embeddedMpvAudioLanguageOptions,
    Settings,
    STORE_KEY,
} from '@iptvnator/shared/interfaces';

/** What the default audio language (original) adds after the user lines. */
const ORIGINAL_AUDIO = embeddedMpvAudioLanguageOptions('original');
import { mirrorEmbeddedMpvSessionOptions } from './embedded-mpv-session-options-mirror';
import { EpgSourceSettingsService } from './epg-source-settings.service';
import { SettingsStore } from './settings-store.service';

describe('SettingsStore playback smoothness ("Fluidez")', () => {
    const testWindow = window as unknown as {
        electron?: { platform: string; updateSettings: jest.Mock };
    };
    const originalElectron = testWindow.electron;
    let storedSettings: Partial<Settings> | null;
    let storage: { get: jest.Mock; set: jest.Mock };
    let injector: Injector;

    function createInjector(): Injector {
        const created = Injector.create({
            providers: [
                SettingsStore,
                EpgSourceSettingsService,
                { provide: StorageMap, useValue: storage },
            ],
        });
        jest.spyOn(
            created.get(EpgSourceSettingsService),
            'synchronize'
        ).mockResolvedValue(undefined);
        return created;
    }

    beforeEach(() => {
        storedSettings = null;
        storage = {
            get: jest.fn(() => of(storedSettings)),
            set: jest.fn(() => of(undefined)),
        };
        injector = createInjector();
    });

    afterEach(() => {
        testWindow.electron = originalElectron;
        jest.restoreAllMocks();
    });

    async function load(): Promise<InstanceType<typeof SettingsStore>> {
        const store = injector.get(SettingsStore);
        await store.loadSettings();
        return store;
    }

    it('defaults to "Más estable" for settings saved before the choice existed', async () => {
        storedSettings = { embeddedMpvExtraOptions: 'volume-max=150' };

        const store = await load();

        expect(store.getSettings().playbackSmoothness).toBe('stable');
    });

    it('restores a saved "normal"', async () => {
        storedSettings = { playbackSmoothness: 'normal' };

        expect((await load()).getSettings().playbackSmoothness).toBe('normal');
    });

    it('normalizes a stored or updated unknown value to the default', async () => {
        const turbo = 'turbo' as Settings['playbackSmoothness'];
        storedSettings = { playbackSmoothness: turbo };
        const store = await load();
        expect(store.playbackSmoothness?.()).toBe('stable');

        await store.updateSettings({ playbackSmoothness: 'normal' });
        await store.updateSettings({ playbackSmoothness: turbo });
        expect(store.getSettings().playbackSmoothness).toBe('stable');
    });

    it('persists a change with the other settings', async () => {
        const store = await load();

        await store.updateSettings({ playbackSmoothness: 'normal' });

        expect(storage.set).toHaveBeenLastCalledWith(
            STORE_KEY.Settings,
            expect.objectContaining({ playbackSmoothness: 'normal' })
        );
    });

    it('mirrors the merged embedded MPV options to main once settings load', async () => {
        const updateSettings = jest.fn().mockResolvedValue(undefined);
        testWindow.electron = { platform: 'darwin', updateSettings };
        storedSettings = { embeddedMpvExtraOptions: 'hwdec=no' };

        await load();

        expect(updateSettings).toHaveBeenCalledTimes(1);
        const mirrored: string =
            updateSettings.mock.calls[0][0].embeddedMpvExtraOptions;
        expect(mirrored.split('\n')).toEqual([
            'hwdec=no',
            ...EMBEDDED_MPV_STABLE_OPTIONS.filter(
                (line) => !line.startsWith('hwdec=')
            ),
            ...ORIGINAL_AUDIO,
        ]);
    });

    it('mirrors no stability option in "normal", and all on a fresh profile', async () => {
        const updateSettings = jest.fn().mockResolvedValue(undefined);
        testWindow.electron = { platform: 'darwin', updateSettings };
        storedSettings = {
            embeddedMpvExtraOptions: 'volume-max=150',
            playbackSmoothness: 'normal',
        };
        await load();
        expect(updateSettings).toHaveBeenLastCalledWith({
            embeddedMpvExtraOptions: ['volume-max=150', ...ORIGINAL_AUDIO].join(
                '\n'
            ),
        });

        storedSettings = null;
        await createInjector().get(SettingsStore).loadSettings();
        expect(updateSettings).toHaveBeenLastCalledWith({
            embeddedMpvExtraOptions: [
                ...EMBEDDED_MPV_STABLE_OPTIONS,
                ...ORIGINAL_AUDIO,
            ].join('\n'),
        });
    });

    it('keeps the previous mirror when main refuses the write', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        testWindow.electron = {
            platform: 'linux',
            updateSettings: jest.fn().mockRejectedValue(new Error('closed')),
        };

        await expect(
            mirrorEmbeddedMpvSessionOptions({ playbackSmoothness: 'stable' })
        ).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });
});
