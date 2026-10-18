import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import {
    NAV_SIDEBAR_HIDDEN_STORAGE_KEY,
    WorkspaceNavSidebarService,
} from '../../services/workspace-nav-sidebar.service';
import { WorkspaceShellNavTabComponent } from './workspace-shell-nav-tab.component';

describe('WorkspaceShellNavTabComponent', () => {
    let fixture: ComponentFixture<WorkspaceShellNavTabComponent>;
    let navSidebar: WorkspaceNavSidebarService;
    const tab = () =>
        fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    beforeEach(async () => {
        localStorage.clear();
        await TestBed.configureTestingModule({
            imports: [WorkspaceShellNavTabComponent, NoopAnimationsModule],
            providers: [
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

        navSidebar = TestBed.inject(WorkspaceNavSidebarService);
        fixture = TestBed.createComponent(WorkspaceShellNavTabComponent);
        fixture.componentRef.setInput('controls', 'workspace-nav-sidebar');
        fixture.detectChanges();
    });

    afterEach(() => localStorage.clear());

    it('hides the shown sidebar and shows it again, as one control', () => {
        const button = tab();
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(button.getAttribute('aria-label')).toBe(
            'WORKSPACE.SIDEBAR.HIDE'
        );
        expect(button.getAttribute('aria-controls')).toBe(
            'workspace-nav-sidebar'
        );
        expect(button.getAttribute('aria-keyshortcuts')).toBe(
            navSidebar.ariaShortcut
        );

        button.click();
        fixture.detectChanges();
        expect(navSidebar.collapsed()).toBe(true);
        expect(localStorage.getItem(NAV_SIDEBAR_HIDDEN_STORAGE_KEY)).toBe('1');
        expect(tab()).toBe(button);
        expect(button.dataset['testId']).toBe('nav-sidebar-show');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.getAttribute('aria-label')).toBe(
            'WORKSPACE.SIDEBAR.SHOW'
        );

        button.click();
        fixture.detectChanges();
        expect(navSidebar.collapsed()).toBe(false);
        expect(button.dataset['testId']).toBe('nav-sidebar-tab');
    });

    it('takes focus on request', () => {
        navSidebar.hide();
        fixture.detectChanges();

        fixture.componentInstance.focus();
        expect(document.activeElement).toBe(tab());
    });

    it('stays clickable in the macOS drag strip and rings focus inside itself', () => {
        const styleSource = readFileSync(
            join(__dirname, 'workspace-shell-nav-tab.component.scss'),
            'utf8'
        );

        expect(styleSource).toMatch(/\.nav-tab\s*\{[^}]*app-region:\s*no-drag/);
        expect(styleSource).toMatch(
            /focus-ring-declarations\(\$offset:\s*-2px\)/
        );
    });
});
