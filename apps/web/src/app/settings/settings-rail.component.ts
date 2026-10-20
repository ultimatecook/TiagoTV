import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    input,
    signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
    registerWorkspaceBack,
    WorkspaceBackNavigationService,
} from '@iptvnator/portal/shared/data-access';
import { WorkspaceStartupPreferencesService } from '@iptvnator/workspace/shell/util';
import { SettingsContextService } from '@iptvnator/workspace/shell/util/settings-context';
import { SETTINGS_NAV_GROUPS } from '@iptvnator/workspace/shell/util/settings-search';
import { SettingsSection } from './settings.models';

interface SettingsRailGroup {
    readonly id: string;
    readonly labelKey: string;
    readonly sections: readonly SettingsSection[];
}

/**
 * The settings page's own left rail (TiagoTV top-bar layout: the shell has
 * no sidebar any more): the "Ajustes" title and the section pages grouped
 * as Cuenta, Aplicación, Biblioteca, Dispositivos and Datos, with "Acerca
 * de" pinned under a separator. A page with staged edits carries a dot;
 * while a settings search (the top bar's field, `q`) is active each page
 * shows how many of its settings match. Esc leaves settings, as the
 * shell's settings panel used to offer.
 */
@Component({
    selector: 'app-settings-rail',
    imports: [NgTemplateOutlet, TranslateModule],
    templateUrl: './settings-rail.component.html',
    styleUrl: './settings-rail.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsRailComponent {
    readonly ctx = inject(SettingsContextService);
    private readonly router = inject(Router);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly backNavigation = inject(WorkspaceBackNavigationService);
    private readonly startupPreferences = inject(
        WorkspaceStartupPreferencesService
    );

    /** The section pages this runtime offers, in navigation order. */
    readonly sections = input.required<readonly SettingsSection[]>();
    readonly activeSection = input.required<string>();

    /** Grouped sections in group order; empty groups are left out. */
    readonly groups = computed<readonly SettingsRailGroup[]>(() => {
        const sections = this.sections();
        return SETTINGS_NAV_GROUPS.map((group) => ({
            id: group.id,
            labelKey: group.labelKey,
            sections: sections.filter((section) => section.group === group.id),
        })).filter((group) => group.sections.length > 0);
    });

    /** Each section page's URL, for its link. */
    readonly hrefs = computed(
        () =>
            new Map(
                this.sections().map((section) => [
                    section.id,
                    this.router.serializeUrl(
                        this.router.createUrlTree([
                            '/workspace/settings',
                            section.id,
                        ])
                    ),
                ])
            )
    );

    /** Sections without a group sit at the bottom (About). */
    readonly footer = computed(() =>
        this.sections().filter((section) => !section.group)
    );

    constructor() {
        // Back from settings (header Back, Esc): the previous page, or the
        // first workspace view when settings opened the session.
        registerWorkspaceBack({
            phoneDrawerToggle: 'yield',
            escapeShortcut: signal(true),
            run: () => this.leaveSettings(),
        });
        // Capture phase: a tooltip still showing (the Ajustes circle's,
        // under the pointer that just clicked it) hides on Escape and stops
        // the key at <body>, so a document listener never saw that first
        // press. What must take Escape first keeps it: an overlay with a
        // backdrop (dialog, menu, select), a field, fullscreen.
        const document = this.host.nativeElement.ownerDocument;
        const listener = (event: KeyboardEvent) => {
            if (event.key === 'Escape') this.onEscape(event);
        };
        document.addEventListener('keydown', listener, true);
        inject(DestroyRef).onDestroy(() =>
            document.removeEventListener('keydown', listener, true)
        );
    }

    /** A modified click (new window, download) keeps the browser's default. */
    onSectionClick(event: MouseEvent, sectionId: string): void {
        if (
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }
        event.preventDefault();
        this.openSection(sectionId);
    }

    /**
     * replaceUrl keeps a single settings entry in the browser history:
     * switching sections must not turn Back into a walk through every
     * visited section page. A settings search term is left behind.
     */
    openSection(sectionId: string): void {
        void this.router.navigate(['/workspace/settings', sectionId], {
            replaceUrl: true,
        });
    }

    /**
     * Esc leaves settings unless something closer owns it: a modifier chord,
     * an already handled key, an open overlay (select panel, menu, dialog),
     * text being edited, browser fullscreen, or a surface over the page
     * (the full-window player leaves the page inert).
     */
    onEscape(event: Event): void {
        const keyboard = event as KeyboardEvent;
        if (
            keyboard.defaultPrevented ||
            keyboard.repeat ||
            keyboard.altKey ||
            keyboard.ctrlKey ||
            keyboard.metaKey ||
            keyboard.shiftKey
        ) {
            return;
        }
        const document = this.host.nativeElement.ownerDocument;
        if (document.fullscreenElement) return;
        if (document.querySelector('.cdk-overlay-backdrop')) return;
        if (this.host.nativeElement.closest('[inert]')) return;
        const target = keyboard.target as HTMLElement | null;
        if (
            target?.isContentEditable ||
            target?.closest(
                'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
            )
        ) {
            return;
        }
        keyboard.preventDefault();
        this.leaveSettings();
    }

    private leaveSettings(): void {
        this.backNavigation.back(() =>
            this.startupPreferences.resolveDashboardPath()
        );
    }
}
