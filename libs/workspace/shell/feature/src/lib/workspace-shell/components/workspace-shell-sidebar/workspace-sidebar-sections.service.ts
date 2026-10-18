import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

/** The sidebar's collapsible sections. */
export type WorkspaceSidebarSectionId =
    'platforms' | 'sports' | 'live' | 'saved';

/** JSON map of the sections the viewer closed, e.g. `{"sports":false}`. */
export const SIDEBAR_SECTIONS_STORAGE_KEY = 'tiagotv:sidebar-sections';

type OpenState = Readonly<Partial<Record<WorkspaceSidebarSectionId, boolean>>>;

/**
 * Which sidebar sections are open (remembered across launches) and which
 * long lists show every row (for the session only). Sections start open.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceSidebarSectionsService {
    private readonly view = inject(DOCUMENT).defaultView;
    private readonly openState = signal<OpenState>(this.readStored());
    private readonly showAllState = signal<
        ReadonlySet<WorkspaceSidebarSectionId>
    >(new Set());

    isOpen(id: WorkspaceSidebarSectionId): boolean {
        return this.openState()[id] ?? true;
    }

    toggle(id: WorkspaceSidebarSectionId): void {
        const next = { ...this.openState(), [id]: !this.isOpen(id) };
        this.openState.set(next);
        try {
            this.view?.localStorage?.setItem(
                SIDEBAR_SECTIONS_STORAGE_KEY,
                JSON.stringify(next)
            );
        } catch {
            // Storage refused (private mode, quota): it lasts the session.
        }
    }

    showsAll(id: WorkspaceSidebarSectionId): boolean {
        return this.showAllState().has(id);
    }

    toggleShowAll(id: WorkspaceSidebarSectionId): void {
        const next = new Set(this.showAllState());
        if (!next.delete(id)) {
            next.add(id);
        }
        this.showAllState.set(next);
    }

    private readStored(): OpenState {
        try {
            const raw = this.view?.localStorage?.getItem(
                SIDEBAR_SECTIONS_STORAGE_KEY
            );
            const parsed: unknown = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object'
                ? (parsed as OpenState)
                : {};
        } catch {
            return {};
        }
    }
}
