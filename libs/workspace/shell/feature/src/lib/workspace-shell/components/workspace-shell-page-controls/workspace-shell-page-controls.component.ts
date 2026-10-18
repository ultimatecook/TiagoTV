import {
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    input,
    output,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    WorkspaceBackTarget,
    WorkspaceHeaderAction,
} from '@iptvnator/portal/shared/util';
import { WorkspaceHeaderSidebarToggle } from '../../services/helpers/workspace-shell-constants';

/**
 * What the removed header bar used to hold for the page itself, floating
 * over the content as round glass buttons: Back (and, on a phone, the
 * context drawer's toggle) at the top-left, the page's own shortcut and the
 * live channel list toggle at the top-right. Each shows only when the page
 * offers it; the window, sources and app actions moved to the sidebar and
 * Settings, and the hidden sidebar's way back is the pull tab on the
 * window's left edge (`WorkspaceShellNavTabComponent`).
 */
@Component({
    selector: 'app-workspace-shell-page-controls',
    imports: [MatIcon, MatTooltip, TranslatePipe],
    templateUrl: './workspace-shell-page-controls.component.html',
    styleUrl: './workspace-shell-page-controls.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellPageControlsComponent {
    private readonly contextDrawerToggle = viewChild<
        ElementRef<HTMLButtonElement>
    >('contextDrawerToggle');

    /** The page's Back or the history fallback; null when there is neither. */
    readonly backTarget = input<WorkspaceBackTarget | null>(null);
    /** Home is the top of the app: Back would sit on its hero. */
    readonly hideBack = input(false);
    readonly headerShortcut = input<WorkspaceHeaderAction | null>(null);
    readonly headerSidebarToggle = input<WorkspaceHeaderSidebarToggle | null>(
        null
    );
    /**
     * Phone-width (≤640px) drawer toggle for the context panel; hidden by
     * CSS above the breakpoint, where the panel shows beside the content.
     */
    readonly showContextDrawerToggle = input(false);
    readonly isContextDrawerOpen = input(false);
    /** Variant-aware labels: categories, type filters or settings sections. */
    readonly contextDrawerToggleAriaKey = input(
        'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOGGLE'
    );
    readonly contextDrawerTooltipKey = input(
        'WORKSPACE.SHELL.CONTEXT_DRAWER_CATEGORIES_TOOLTIP'
    );

    readonly backRequested = output<void>();
    readonly contextDrawerToggleRequested = output<void>();
    readonly headerShortcutRequested = output<void>();
    readonly headerSidebarToggleRequested = output<void>();

    readonly back = computed(() =>
        this.hideBack() ? null : this.backTarget()
    );
    private readonly backPhoneSlot = computed(() => {
        const back = this.back();
        return back ? (back.phoneDrawerToggle ?? 'replace') : null;
    });
    /** The drawer toggle renders unless Back takes its phone slot. */
    readonly showDrawerToggle = computed(
        () =>
            this.showContextDrawerToggle() && this.backPhoneSlot() !== 'replace'
    );
    /** At phone width, Back hides behind a shown drawer toggle. */
    readonly backYieldsToDrawerToggle = computed(
        () => this.showDrawerToggle() && this.backPhoneSlot() === 'yield'
    );

    /**
     * The tooltip advertises Escape for Back. The page only handles it with
     * focus inside the page, so the button keeps that promise itself.
     */
    onBackEscape(event: Event): void {
        const keyboard = event as KeyboardEvent;
        if (
            !this.back()?.escapeShortcut() ||
            keyboard.defaultPrevented ||
            keyboard.repeat ||
            keyboard.altKey ||
            keyboard.ctrlKey ||
            keyboard.metaKey ||
            keyboard.shiftKey
        ) {
            return;
        }
        keyboard.preventDefault();
        this.backRequested.emit();
    }

    /**
     * Returns focus to the drawer toggle after the drawer closes. Reports
     * whether the toggle actually received focus: after a navigation to a
     * route without a context panel the toggle is gone (and above the phone
     * breakpoint it is display: none), and the caller needs a fallback.
     */
    focusContextDrawerToggle(): boolean {
        const toggle = this.contextDrawerToggle()?.nativeElement;
        if (!toggle) {
            return false;
        }

        toggle.focus();
        return document.activeElement === toggle;
    }
}
