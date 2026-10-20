import type { MatDialogConfig } from '@angular/material/dialog';

/** The width presets of the UI kit's dialog shell. */
export type DialogSize = 'sm' | 'md' | 'lg';

/**
 * - `sm`: a confirmation or a PIN prompt; two actions fit side by side in
 *   every locale.
 * - `md`: a form or a list.
 * - `lg`: a picker with a grid, a table, or long text.
 */
export const DIALOG_WIDTHS: Readonly<Record<DialogSize, string>> = {
    sm: '440px',
    md: '560px',
    lg: '760px',
};

/**
 * The room a dialog keeps from the window's top and bottom edges: 16px, or
 * on macOS the clearance below the native traffic lights, which the
 * workspace shell publishes on `<html>` as `--traffic-lights-clear-y`
 * (zoom-scaled; unset in the browser and `0px` in fullscreen). The dialog
 * stays centred, so it keeps that room at both edges.
 */
export const DIALOG_EDGE_ROOM = 'max(16px, var(--traffic-lights-clear-y, 0px))';

/**
 * The part of a `MatDialogConfig` a size preset owns. Spread it before the
 * call site's own options, so `data`, `autoFocus` or a tighter `maxHeight`
 * still win. The import is type-only, and a service created with the app
 * imports this file through `@iptvnator/ui/components/dialog-size`: the
 * library barrel would carry its components onto the startup path.
 */
export function dialogSize(
    size: DialogSize
): Pick<MatDialogConfig, 'width' | 'maxWidth' | 'maxHeight'> {
    return {
        width: DIALOG_WIDTHS[size],
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: `calc(100vh - 2 * ${DIALOG_EDGE_ROOM})`,
    };
}
