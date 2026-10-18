import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { WorkspaceNavSidebarService } from '../../services/workspace-nav-sidebar.service';
import type { WorkspaceSidebarEntry } from './workspace-sidebar-catalog.service';
import { WorkspaceShellSidebarSectionComponent } from './workspace-shell-sidebar-section.component';
import { SIDEBAR_SECTIONS_STORAGE_KEY } from './workspace-sidebar-sections.service';

function entry(id: string, extra: Partial<WorkspaceSidebarEntry> = {}) {
    return {
        id,
        label: id.toUpperCase(),
        link: ['/workspace', 'platforms', id],
        chip: {
            background: '#000',
            logo: null,
            whiteLogo: false,
            logoSize: 1,
            letter: id.charAt(0),
            letterColor: '#fff',
        },
        ...extra,
    } satisfies WorkspaceSidebarEntry;
}

const ENTRIES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => entry(id));

describe('WorkspaceShellSidebarSectionComponent', () => {
    let fixture: ComponentFixture<WorkspaceShellSidebarSectionComponent>;
    const folded = signal(false);
    const rows = () =>
        Array.from(
            fixture.nativeElement.querySelectorAll('.section__row')
        ) as HTMLElement[];
    const toggle = () =>
        fixture.nativeElement.querySelector(
            '[data-test-id="sidebar-section-platforms"]'
        ) as HTMLButtonElement;

    async function create(): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [WorkspaceShellSidebarSectionComponent],
            providers: [
                provideRouter([]),
                {
                    provide: WorkspaceNavSidebarService,
                    useValue: { isFolded: folded },
                },
                {
                    provide: TranslateService,
                    useValue: {
                        instant: (key: string) => key,
                        get: (key: string) => of(key),
                        stream: (key: string) => of(key),
                        onLangChange: of(null),
                        onTranslationChange: of(null),
                        onDefaultLangChange: of(null),
                        currentLang: 'en',
                        defaultLang: 'en',
                    },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(
            WorkspaceShellSidebarSectionComponent
        );
        fixture.componentRef.setInput('sectionId', 'platforms');
        fixture.componentRef.setInput(
            'labelKey',
            'WORKSPACE.SIDEBAR.GROUP_PLATFORMS'
        );
        fixture.componentRef.setInput('glyph', 'platforms');
        fixture.componentRef.setInput('entries', ENTRIES);
        fixture.detectChanges();
    }

    beforeEach(() => {
        localStorage.clear();
        folded.set(false);
    });

    afterEach(() => localStorage.clear());

    it('shows the first rows of a long list until "Show more"', async () => {
        await create();

        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(
            rows().map((row) =>
                row.querySelector('.section__row-label')?.textContent?.trim()
            )
        ).toEqual(['A', 'B', 'C', 'D', 'E']);

        const more = fixture.nativeElement.querySelector(
            '[data-test-id="sidebar-more-platforms"]'
        ) as HTMLButtonElement;
        expect(more.getAttribute('aria-expanded')).toBe('false');
        more.click();
        fixture.detectChanges();

        expect(rows()).toHaveLength(7);
        expect(more.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes and opens from its label, remembering the choice', async () => {
        await create();
        const opened = jest.fn();
        fixture.componentInstance.opened.subscribe(opened);

        toggle().click();
        fixture.detectChanges();
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(rows()).toHaveLength(0);
        expect(
            JSON.parse(localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY) ?? '')
        ).toEqual({ platforms: false });

        toggle().click();
        fixture.detectChanges();
        expect(rows()).toHaveLength(5);
        // Opening asks for the rows (the catalog loads them).
        expect(opened).toHaveBeenCalled();
    });

    it('starts closed when it was left closed', async () => {
        localStorage.setItem(
            SIDEBAR_SECTIONS_STORAGE_KEY,
            JSON.stringify({ platforms: false })
        );
        await create();

        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(rows()).toHaveLength(0);
    });

    it('plays a channel row and badges a link row', async () => {
        await create();
        const run = jest.fn();
        fixture.componentRef.setInput('entries', [
            entry('espn', { link: undefined, run }),
        ]);
        fixture.componentRef.setInput('items', [
            {
                id: 'downloads',
                labelKey: 'WORKSPACE.SIDEBAR.DOWNLOADS',
                icon: 'download',
                link: ['/workspace', 'downloads'],
                exact: false,
                highlights: true,
            },
        ]);
        fixture.componentRef.setInput('badges', { downloads: 2 });
        fixture.detectChanges();

        (
            fixture.nativeElement.querySelector(
                '[data-test-id="sidebar-platforms-espn"]'
            ) as HTMLButtonElement
        ).click();
        expect(run).toHaveBeenCalledTimes(1);
        expect(
            fixture.nativeElement.querySelector(
                '[data-test-id="sidebar-badge-downloads"]'
            )?.textContent
        ).toContain('2');
    });

    it('shows its empty line without rows', async () => {
        await create();
        fixture.componentRef.setInput('entries', null);
        fixture.componentRef.setInput('emptyKey', 'WORKSPACE.SIDEBAR.LOADING');
        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelector('.section__empty')?.textContent
        ).toContain('WORKSPACE.SIDEBAR.LOADING');
    });

    it('opens every row in a flyout when folded to icons', async () => {
        folded.set(true);
        await create();
        const overlay = TestBed.inject(OverlayContainer).getContainerElement();

        expect(rows()).toHaveLength(0);
        expect(toggle().getAttribute('aria-haspopup')).toBe('dialog');

        toggle().click();
        fixture.detectChanges();
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(overlay.querySelectorAll('.section__row')).toHaveLength(7);

        fixture.componentInstance.onFlyoutKeydown(
            new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
        );
        fixture.detectChanges();
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        // Folded, the section's open state is left as it was.
        expect(localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY)).toBeNull();
    });
});
