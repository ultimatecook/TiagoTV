import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    inject,
    input,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { WorkspaceNavSidebarService } from '../../services/workspace-nav-sidebar.service';

/**
 * The main navigation's pull tab: a half-round glass handle on the
 * content's left edge, half-way down. While the sidebar is hidden (⌃⌘S) it
 * sits on the window's edge and shows it; while the sidebar shows, it sits
 * on the sidebar's edge and hides it. One button for both states, so focus
 * stays on it across a toggle.
 */
@Component({
    selector: 'app-workspace-shell-nav-tab',
    imports: [MatIcon, MatTooltip, TranslatePipe],
    templateUrl: './workspace-shell-nav-tab.component.html',
    styleUrl: './workspace-shell-nav-tab.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellNavTabComponent {
    readonly navSidebar = inject(WorkspaceNavSidebarService);
    /** The id of the sidebar it shows and hides (`aria-controls`). */
    readonly controls = input<string | null>(null);

    private readonly tab =
        viewChild.required<ElementRef<HTMLButtonElement>>('tab');

    focus(): void {
        this.tab().nativeElement.focus();
    }
}
