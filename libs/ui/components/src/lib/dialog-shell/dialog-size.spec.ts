import { DIALOG_WIDTHS, dialogSize } from './dialog-size';

describe('dialogSize', () => {
    it.each(['sm', 'md', 'lg'] as const)(
        'owns the width and the viewport limits of the %s preset',
        (size) => {
            expect(dialogSize(size)).toEqual({
                width: DIALOG_WIDTHS[size],
                maxWidth: 'calc(100vw - 32px)',
                maxHeight:
                    'calc(100vh - 2 * max(16px, var(--traffic-lights-clear-y, 0px)))',
            });
        }
    );

    it('keeps a centred dialog clear of the macOS traffic lights', () => {
        // The shell publishes the clearance on <html>, zoom-scaled: 50.4px
        // at 125 % (63 window points). The centred dialog leaves that room
        // at both edges, so its header never sits under the lights.
        const root = document.documentElement;
        root.style.setProperty('--traffic-lights-clear-y', '50.4px');
        const probe = document.createElement('div');
        probe.style.maxHeight = dialogSize('lg').maxHeight as string;
        document.body.append(probe);

        // jsdom does not compute calc(): the declaration must parse and keep
        // the clearance, not drop to the 16px floor alone.
        expect(probe.style.maxHeight).toContain(
            'var(--traffic-lights-clear-y'
        );
        expect(probe.style.maxHeight).toContain('2 *');

        probe.remove();
        root.style.removeProperty('--traffic-lights-clear-y');
    });

    it('lets the call site override a limit by spreading the preset first', () => {
        expect({ ...dialogSize('md'), maxHeight: '90vh' }).toMatchObject({
            width: '560px',
            maxHeight: '90vh',
        });
    });
});
