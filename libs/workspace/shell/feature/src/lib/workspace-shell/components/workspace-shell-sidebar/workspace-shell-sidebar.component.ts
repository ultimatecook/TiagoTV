import {
    ChangeDetectionStrategy,
    Component,
    computed,
    ElementRef,
    inject,
    input,
    output,
    viewChild,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { WorkspacePortalContext } from '@iptvnator/workspace/shell/util';
import { WorkspaceNavSidebarService } from '../../services/workspace-nav-sidebar.service';
import { WorkspaceShellSidebarIconComponent } from './workspace-shell-sidebar-icon.component';
import { buildWorkspaceSidebarGroups } from './workspace-shell-sidebar-nav';

/**
 * The TiagoTV glass sidebar: greeting, search and the Home / Library
 * navigation. Search mirrors the header's field (same facade bindings), so
 * the shell can hand either one the find shortcut; the header's copy only
 * shows where the sidebar folds to icons.
 */
@Component({
    selector: 'app-workspace-shell-sidebar',
    imports: [
        MatIcon,
        MatTooltip,
        RouterLink,
        RouterLinkActive,
        TranslatePipe,
        WorkspaceShellSidebarIconComponent,
    ],
    templateUrl: './workspace-shell-sidebar.component.html',
    styleUrl: './workspace-shell-sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellSidebarComponent {
    private readonly searchInput =
        viewChild<ElementRef<HTMLInputElement>>('searchInput');
    private readonly hideButton =
        viewChild<ElementRef<HTMLButtonElement>>('hideButton');
    readonly navSidebar = inject(WorkspaceNavSidebarService);

    /** The active source the catalog entries browse; null without one. */
    readonly context = input<WorkspacePortalContext | null>(null);
    readonly searchQuery = input('');
    readonly canUseSearch = input(false);
    readonly searchPlaceholder = input('');
    readonly hasNoPlaylists = input(false);

    readonly searchChanged = output<string>();
    readonly searchSubmitted = output<string>();

    readonly groups = computed(() =>
        buildWorkspaceSidebarGroups(this.context())
    );

    onSearchInput(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchChanged.emit(target?.value ?? '');
    }

    onSearchEnter(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.searchSubmitted.emit(target?.value ?? this.searchQuery());
    }

    /**
     * Focuses the sidebar search when it is on screen. Reports whether it
     * took focus: folded to icons the field is display: none, and the
     * caller then focuses the header's copy instead.
     */
    focusSearchInput(options: { select?: boolean } = {}): boolean {
        const inputElement = this.searchInput()?.nativeElement;
        if (
            !inputElement ||
            inputElement.disabled ||
            inputElement.offsetParent === null
        ) {
            return false;
        }

        inputElement.focus();
        if (options.select) {
            inputElement.select();
        }
        return document.activeElement === inputElement;
    }

    /** Back on the hide control once the sidebar shows again. */
    focusHideButton(): void {
        this.hideButton()?.nativeElement.focus();
    }

    containsSearchInput(target: EventTarget | null): boolean {
        const inputElement = this.searchInput()?.nativeElement;
        return !!inputElement && target === inputElement;
    }
}
