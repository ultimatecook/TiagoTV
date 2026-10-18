import { nativeTheme } from 'electron';

/**
 * TiagoTV: on macOS the main window is real glass. An NSVisualEffectView
 * sits behind a transparent page, so whatever is behind the window (the
 * desktop, other windows) shows through blurred and tints it, and the
 * window keeps the system's rounded corners. The renderer stops painting
 * its own backdrop on the same condition (`native-glass` on <html>).
 */
export function getNativeGlassWindowOptions(
    platform: NodeJS.Platform = process.platform
): Electron.BrowserWindowConstructorOptions {
    if (platform !== 'darwin') {
        return {};
    }
    return {
        vibrancy: 'under-window',
        // Stays glass while another app is in front, as on the reference.
        visualEffectState: 'active',
        // A transparent page lets the material show through.
        backgroundColor: '#00000000',
    };
}

/**
 * The material follows the window's appearance: a light system appearance
 * would turn the glass white under TiagoTV's white text.
 */
export function applyNativeGlassAppearance(
    platform: NodeJS.Platform = process.platform
): void {
    if (platform === 'darwin') {
        nativeTheme.themeSource = 'dark';
    }
}
