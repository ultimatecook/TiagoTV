const mockNativeTheme = { themeSource: 'system' };

jest.mock('electron', () => ({ nativeTheme: mockNativeTheme }));

import {
    applyNativeGlassAppearance,
    getNativeGlassWindowOptions,
} from './native-glass-window';

describe('native glass window', () => {
    beforeEach(() => {
        mockNativeTheme.themeSource = 'system';
    });

    it('turns the macOS window into transparent, always-active glass', () => {
        expect(getNativeGlassWindowOptions('darwin')).toEqual({
            vibrancy: 'under-window',
            visualEffectState: 'active',
            backgroundColor: '#00000000',
        });
        applyNativeGlassAppearance('darwin');
        expect(mockNativeTheme.themeSource).toBe('dark');
    });

    it('leaves Windows and Linux windows as they are', () => {
        expect(getNativeGlassWindowOptions('win32')).toEqual({});
        expect(getNativeGlassWindowOptions('linux')).toEqual({});
        applyNativeGlassAppearance('linux');
        expect(mockNativeTheme.themeSource).toBe('system');
    });
});
