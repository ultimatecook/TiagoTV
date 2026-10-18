import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    ConnectedPosition,
} from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    input,
    output,
    signal,
    untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WorkspaceNavSidebarService } from '../../services/workspace-nav-sidebar.service';
import type { WorkspaceSidebarEntry } from './workspace-sidebar-catalog.service';
import type { WorkspaceSidebarItem } from './workspace-shell-sidebar-nav';
import { WorkspaceShellSidebarIconComponent } from './workspace-shell-sidebar-icon.component';
import type { WorkspaceSidebarIconName } from './workspace-shell-sidebar-icon.component';
import {
    WorkspaceSidebarSectionId,
    WorkspaceSidebarSectionsService,
} from './workspace-sidebar-sections.service';

/** Rows a long list shows before "Show N more". */
export const SIDEBAR_SECTION_LIMIT = 5;

/** Folded: beside the icon, or under it on the phone strip. */
const FLYOUT_POSITIONS: ConnectedPosition[] = [
    {
        originX: 'end',
        originY: 'top',
        overlayX: 'start',
        overlayY: 'top',
        offsetX: 10,
    },
    {
        originX: 'end',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'bottom',
        offsetX: 10,
    },
    {
        originX: 'start',
        originY: 'bottom',
        overlayX: 'start',
        overlayY: 'top',
        offsetY: 8,
    },
];

/**
 * One collapsible sidebar section: a small uppercase label with a
 * disclosure chevron, then its brand rows (Plataformas, Deportes, Canales
 * en vivo) and fixed links (Guardados, "Todos los canales"). Folded to
 * icons, the section is its icon, which opens the rows in a flyout.
 */
@Component({
    selector: 'app-workspace-shell-sidebar-section',
    imports: [
        CdkConnectedOverlay,
        CdkOverlayOrigin,
        CdkTrapFocus,
        NgTemplateOutlet,
        RouterLink,
        RouterLinkActive,
        TranslatePipe,
        WorkspaceShellSidebarIconComponent,
    ],
    templateUrl: './workspace-shell-sidebar-section.component.html',
    styleUrl: './workspace-shell-sidebar-section.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'sidebar-section',
        '[attr.data-section]': 'sectionId()',
    },
})
export class WorkspaceShellSidebarSectionComponent {
    private readonly sections = inject(WorkspaceSidebarSectionsService);
    readonly navSidebar = inject(WorkspaceNavSidebarService);

    readonly sectionId = input.required<WorkspaceSidebarSectionId>();
    readonly labelKey = input.required<string>();
    /** The line icon that stands for the section when folded. */
    readonly glyph = input.required<WorkspaceSidebarIconName>();
    /** Brand rows; null while they load. */
    readonly entries = input<readonly WorkspaceSidebarEntry[] | null>([]);
    /** Fixed links after the brand rows. */
    readonly items = input<readonly WorkspaceSidebarItem[]>([]);
    /** Shown when there are no rows at all. */
    readonly emptyKey = input('');
    /** Badges by item id, e.g. the active downloads. */
    readonly badges = input<Readonly<Record<string, number>>>({});
    /** The rows are needed: the section opened (inline or as a flyout). */
    readonly opened = output<void>();

    readonly positions = FLYOUT_POSITIONS;
    readonly flyoutOpen = signal(false);
    readonly open = computed(() => this.sections.isOpen(this.sectionId()));
    readonly folded = this.navSidebar.isFolded;
    readonly showsAll = computed(() =>
        this.sections.showsAll(this.sectionId())
    );
    readonly hiddenCount = computed(() =>
        Math.max(0, (this.entries()?.length ?? 0) - SIDEBAR_SECTION_LIMIT)
    );
    /** Inline, a long list shows its first rows until "Show N more". */
    readonly inlineEntries = computed(() => {
        const entries = this.entries() ?? [];
        return this.showsAll()
            ? entries
            : entries.slice(0, SIDEBAR_SECTION_LIMIT);
    });
    /** No rows to show: the empty (or loading) line takes their place. */
    readonly isEmpty = computed(
        () =>
            !!this.emptyKey() &&
            (this.entries()?.length ?? 0) === 0 &&
            this.items().length === 0
    );
    readonly listId = computed(() => `sidebar-section-${this.sectionId()}`);

    constructor() {
        // Rows load once the section shows them: open inline, or flyout.
        effect(() => {
            const needed = this.folded() ? this.flyoutOpen() : this.open();
            if (needed) {
                untracked(() => this.opened.emit());
            }
        });
        // Unfolding while a flyout is open would leave it over the list.
        effect(() => {
            if (!this.folded()) {
                untracked(() => this.flyoutOpen.set(false));
            }
        });
    }

    toggle(): void {
        if (this.folded()) {
            this.flyoutOpen.update((open) => !open);
            return;
        }
        this.sections.toggle(this.sectionId());
    }

    toggleShowAll(): void {
        this.sections.toggleShowAll(this.sectionId());
    }

    closeFlyout(): void {
        this.flyoutOpen.set(false);
    }

    /** A brand row that plays (a live channel) rather than navigates. */
    runEntry(entry: WorkspaceSidebarEntry): void {
        this.closeFlyout();
        entry.run?.();
    }

    onFlyoutKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeFlyout();
        }
    }
}
