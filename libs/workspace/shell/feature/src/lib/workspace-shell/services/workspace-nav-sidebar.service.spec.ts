import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
    NAV_SIDEBAR_HIDDEN_STORAGE_KEY,
    WorkspaceNavSidebarService,
} from './workspace-nav-sidebar.service';

interface FakeView {
    localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
    navigator: { userAgent: string };
    matchMedia?: jest.Mock;
}

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: jest.fn((key: string) => values.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => {
            values.set(key, value);
        }),
        removeItem: jest.fn((key: string) => {
            values.delete(key);
        }),
    };
}

function createService(view: Partial<FakeView> = {}) {
    const fakeView: FakeView = {
        localStorage: memoryStorage(),
        navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' },
        ...view,
    };
    TestBed.configureTestingModule({
        providers: [{ provide: DOCUMENT, useValue: { defaultView: fakeView } }],
    });
    return { service: TestBed.inject(WorkspaceNavSidebarService), fakeView };
}

function keydown(init: KeyboardEventInit): KeyboardEvent {
    return new KeyboardEvent('keydown', init);
}

describe('WorkspaceNavSidebarService', () => {
    it('starts shown and remembers hiding across launches', () => {
        const { service, fakeView } = createService();

        expect(service.hidden()).toBe(false);
        expect(service.collapsed()).toBe(false);

        service.toggle();
        expect(service.hidden()).toBe(true);
        expect(service.collapsed()).toBe(true);
        expect(fakeView.localStorage.setItem).toHaveBeenCalledWith(
            NAV_SIDEBAR_HIDDEN_STORAGE_KEY,
            '1'
        );

        service.show();
        expect(service.hidden()).toBe(false);
        expect(fakeView.localStorage.removeItem).toHaveBeenCalledWith(
            NAV_SIDEBAR_HIDDEN_STORAGE_KEY
        );
    });

    it('restores a hidden sidebar', () => {
        const { service } = createService({
            localStorage: memoryStorage({
                [NAV_SIDEBAR_HIDDEN_STORAGE_KEY]: '1',
            }),
        });

        expect(service.hidden()).toBe(true);
    });

    it('still toggles when storage throws', () => {
        const refusing = {
            getItem: jest.fn(() => {
                throw new Error('SecurityError');
            }),
            setItem: jest.fn(() => {
                throw new Error('QuotaExceededError');
            }),
            removeItem: jest.fn(),
        };
        const { service } = createService({ localStorage: refusing });

        expect(service.hidden()).toBe(false);
        service.hide();
        expect(service.hidden()).toBe(true);
    });

    it('keeps the phone strip whatever the choice', () => {
        let onChange: ((event: { matches: boolean }) => void) | undefined;
        const matchMedia = jest.fn(() => ({
            matches: true,
            addEventListener: (
                _type: string,
                listener: (event: { matches: boolean }) => void
            ) => (onChange = listener),
            removeEventListener: jest.fn(),
        }));
        const { service } = createService({ matchMedia });

        service.hide();
        expect(matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
        expect(service.hidden()).toBe(true);
        expect(service.collapsed()).toBe(false);

        onChange?.({ matches: false });
        expect(service.collapsed()).toBe(true);
    });

    it('takes Ctrl+Alt+S off macOS', () => {
        const { service } = createService();

        expect(service.shortcutLabel).toBe('Ctrl+Alt+S');
        expect(
            service.isShortcut(
                keydown({ key: 's', code: 'KeyS', ctrlKey: true, altKey: true })
            )
        ).toBe(true);
        expect(
            service.isShortcut(
                keydown({
                    key: 's',
                    code: 'KeyS',
                    ctrlKey: true,
                    metaKey: true,
                })
            )
        ).toBe(false);
        expect(
            service.isShortcut(
                keydown({ key: 's', code: 'KeyS', ctrlKey: true })
            )
        ).toBe(false);
    });

    it('takes Control+Command+S on macOS', () => {
        const { service } = createService({
            navigator: {
                userAgent:
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TiagoTV',
            },
        });

        expect(service.shortcutLabel).toBe('⌃⌘S');
        expect(
            service.isShortcut(
                keydown({
                    key: 's',
                    code: 'KeyS',
                    ctrlKey: true,
                    metaKey: true,
                })
            )
        ).toBe(true);
        expect(
            service.isShortcut(
                keydown({
                    key: 'S',
                    code: 'KeyS',
                    ctrlKey: true,
                    metaKey: true,
                    shiftKey: true,
                })
            )
        ).toBe(false);
        expect(
            service.isShortcut(
                keydown({ key: 's', code: 'KeyS', ctrlKey: true, altKey: true })
            )
        ).toBe(false);
    });
});
