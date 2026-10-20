import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    stepZoomLevel,
    ZOOM_LEVEL_MAX,
    ZOOM_LEVEL_MIN,
    type ZoomLevelAction,
} from '@iptvnator/shared/interfaces';
import {
    applyDefaultUiScale,
    DEFAULT_UI_SCALE_STORAGE_KEY,
    DEFAULT_UI_ZOOM_LEVEL,
    provideDefaultUiScale,
    type UiScaleFlagStore,
} from './default-ui-scale';

/** The preload's bridge (`adjustFrameZoomLevel`) over a frame's level. */
function fakeBridge(level: number) {
    const bridge = {
        level,
        calls: [] as ZoomLevelAction[],
        adjustZoomLevel(action: ZoomLevelAction): number {
            bridge.calls.push(action);
            bridge.level = stepZoomLevel(bridge.level, action);
            return bridge.level;
        },
    };
    return bridge;
}

function memoryStore(): UiScaleFlagStore & { items: Map<string, string> } {
    const items = new Map<string, string>();
    return {
        items,
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value),
    };
}

describe('applyDefaultUiScale', () => {
    it('takes a never-changed zoom to level −1 (≈83 %), once ever', () => {
        const bridge = fakeBridge(0);
        const store = memoryStore();

        expect(applyDefaultUiScale(bridge, store)).toBe('applied');
        expect(bridge.level).toBe(DEFAULT_UI_ZOOM_LEVEL);
        expect(DEFAULT_UI_ZOOM_LEVEL).toBe(-1);
        expect(store.items.has(DEFAULT_UI_SCALE_STORAGE_KEY)).toBe(true);

        // A later start, even after the user reset to 100 %, leaves it.
        bridge.level = 0;
        expect(applyDefaultUiScale(bridge, store)).toBe('done-before');
        expect(bridge.level).toBe(0);
        expect(bridge.calls).toEqual(['out', 'out']);
    });

    it.each([1, 0.5, -0.5, -1, -2, ZOOM_LEVEL_MAX])(
        "keeps the level a user chose (%s), undoing the probe",
        (level) => {
            const bridge = fakeBridge(level);

            expect(applyDefaultUiScale(bridge, memoryStore())).toBe('kept');
            expect(bridge.level).toBe(level);
            expect(bridge.calls).toEqual(['out', 'in']);
        }
    );

    it('leaves a level at the minimum where it is', () => {
        const bridge = fakeBridge(ZOOM_LEVEL_MIN);

        expect(applyDefaultUiScale(bridge, memoryStore())).toBe('kept');
        expect(bridge.level).toBe(ZOOM_LEVEL_MIN);
    });

    it('does nothing without a zoom bridge (the browser build)', () => {
        const store = memoryStore();

        expect(applyDefaultUiScale(undefined, store)).toBe('unavailable');
        expect(applyDefaultUiScale({}, store)).toBe('unavailable');
        expect(store.items.size).toBe(0);
    });

    it('does nothing where the flag cannot be kept', () => {
        const bridge = fakeBridge(0);
        const blocked: UiScaleFlagStore = {
            getItem: () => null,
            setItem: () => {
                throw new Error('QuotaExceededError');
            },
        };

        expect(applyDefaultUiScale(bridge, blocked)).toBe('unavailable');
        expect(applyDefaultUiScale(bridge, null)).toBe('unavailable');
        expect(bridge.calls).toEqual([]);
    });

    it('survives a frame that refuses the write', () => {
        const bridge = {
            adjustZoomLevel: jest.fn(() => {
                throw new Error('refused');
            }),
        };

        expect(applyDefaultUiScale(bridge, memoryStore())).toBe('kept');
    });
});

describe('provideDefaultUiScale', () => {
    const original = window.electron;

    afterEach(() => {
        window.electron = original;
        localStorage.removeItem(DEFAULT_UI_SCALE_STORAGE_KEY);
    });

    it('applies the default scale at startup through the bridge', async () => {
        const bridge = fakeBridge(0);
        window.electron = bridge as unknown as typeof window.electron;
        localStorage.removeItem(DEFAULT_UI_SCALE_STORAGE_KEY);

        TestBed.configureTestingModule({
            providers: [provideDefaultUiScale()],
        });
        await TestBed.inject(ApplicationInitStatus).donePromise;

        expect(bridge.level).toBe(DEFAULT_UI_ZOOM_LEVEL);
        expect(
            localStorage.getItem(DEFAULT_UI_SCALE_STORAGE_KEY)
        ).not.toBeNull();
    });
});
