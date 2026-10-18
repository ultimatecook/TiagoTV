import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type WorkspaceSidebarIconName =
    | 'home'
    | 'flame'
    | 'tv'
    | 'film'
    | 'plus'
    | 'globe'
    | 'clock'
    | 'watch-later'
    | 'download'
    | 'user'
    | 'settings'
    | 'search'
    | 'chevron'
    | 'platforms'
    | 'trophy'
    | 'live'
    | 'channels'
    | 'bookmark'
    | 'lock'
    | 'lock-open';

/**
 * Thin line icons for the TiagoTV sidebar (24px grid, 1.6px stroke). The
 * Material ligature font has no outlined set loaded, and the glass sidebar
 * wants the lighter line weight; `filled` paints the shape for the active
 * entry the way the home glyph reads when selected.
 */
@Component({
    selector: 'app-workspace-shell-sidebar-icon',
    template: `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            @switch (name()) {
                @case ('home') {
                    <path
                        [attr.fill]="filled() ? 'currentColor' : 'none'"
                        d="M3.5 10.4 12 3.5l8.5 6.9V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.6H9.2v5.6H5A1.5 1.5 0 0 1 3.5 19z"
                    />
                }
                @case ('flame') {
                    <path
                        d="M12 20.5c-3.7 0-6.5-2.7-6.5-6.2 0-2.4 1.3-4.3 2.9-5.9.4 1.8 1.4 2.9 2.6 3.3-.3-3.2.8-6.1 3-8.2.5 3 2.2 4.8 3.4 6.3.9 1.2 1.1 2.4 1.1 3.7 0 3.9-2.9 7-6.5 7z"
                    />
                }
                @case ('tv') {
                    <rect x="3" y="7" width="18" height="12.5" rx="2.2" />
                    <path d="M8.5 3 12 6.6 15.5 3" />
                }
                @case ('film') {
                    <path d="M4 10h16v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                    <path
                        d="m4 10-.6-2.9a1.5 1.5 0 0 1 1.1-1.8L17.3 2.6a1.5 1.5 0 0 1 1.8 1.1l.6 2.6L4 10"
                    />
                    <path d="m8.2 5.6 2.6 2.9M13.1 4.6l2.6 2.9" />
                }
                @case ('plus') {
                    <path d="M12 4.5v15M4.5 12h15" />
                }
                @case ('globe') {
                    <circle cx="12" cy="12" r="8.75" />
                    <path
                        d="M3.5 12h17M12 3.25c2.3 2.4 3.4 5.3 3.4 8.75s-1.1 6.35-3.4 8.75c-2.3-2.4-3.4-5.3-3.4-8.75S9.7 5.65 12 3.25z"
                    />
                }
                @case ('clock') {
                    <circle cx="12" cy="12" r="8.75" />
                    <path d="M12 7.2V12l3.2 2" />
                }
                @case ('watch-later') {
                    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
                    <path d="M12 8v4.2l2.8 1.6" />
                }
                @case ('download') {
                    <path
                        d="M12 3.8v11.4m0 0 4.6-4.6M12 15.2l-4.6-4.6M5 20h14"
                    />
                }
                @case ('user') {
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4.5 20.5c1.1-3.6 4-5.6 7.5-5.6s6.4 2 7.5 5.6" />
                }
                @case ('settings') {
                    <circle cx="12" cy="12" r="3" />
                    <path
                        d="M12.2 2.5h-.4a1.9 1.9 0 0 0-1.9 1.9v.2a1.9 1.9 0 0 1-1 1.6l-.4.2a1.9 1.9 0 0 1-1.9 0l-.1-.1a1.9 1.9 0 0 0-2.6.7l-.2.4a1.9 1.9 0 0 0 .7 2.6l.1.1a1.9 1.9 0 0 1 1 1.6v.5a1.9 1.9 0 0 1-1 1.7l-.1.1a1.9 1.9 0 0 0-.7 2.6l.2.4a1.9 1.9 0 0 0 2.6.7l.1-.1a1.9 1.9 0 0 1 1.9 0l.4.2a1.9 1.9 0 0 1 1 1.6v.2a1.9 1.9 0 0 0 1.9 1.9h.4a1.9 1.9 0 0 0 1.9-1.9v-.2a1.9 1.9 0 0 1 1-1.6l.4-.2a1.9 1.9 0 0 1 1.9 0l.1.1a1.9 1.9 0 0 0 2.6-.7l.2-.4a1.9 1.9 0 0 0-.7-2.6l-.1-.1a1.9 1.9 0 0 1-1-1.7v-.5a1.9 1.9 0 0 1 1-1.6l.1-.1a1.9 1.9 0 0 0 .7-2.6l-.2-.4a1.9 1.9 0 0 0-2.6-.7l-.1.1a1.9 1.9 0 0 1-1.9 0l-.4-.2a1.9 1.9 0 0 1-1-1.6v-.2a1.9 1.9 0 0 0-1.9-1.9z"
                    />
                }
                @case ('search') {
                    <circle cx="11" cy="11" r="6.6" />
                    <path d="m20 20-4.3-4.3" />
                }
                @case ('chevron') {
                    <path d="m8 10 4 4 4-4" />
                }
                @case ('platforms') {
                    <rect x="3.5" y="5.5" width="17" height="12" rx="2.5" />
                    <path d="m10.5 9.2 4 2.3-4 2.3z" />
                    <path d="M8.5 20.5h7" />
                }
                @case ('trophy') {
                    <path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z" />
                    <path
                        d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 14v3.5M8.5 20.5h7M9.5 17.5h5"
                    />
                }
                @case ('live') {
                    <circle cx="12" cy="12" r="2" />
                    <path
                        d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"
                    />
                }
                @case ('channels') {
                    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
                    <path d="M7.5 9h9M7.5 12h9M7.5 15h6" />
                }
                @case ('bookmark') {
                    <path d="M6.5 4.5h11v16l-5.5-4-5.5 4z" />
                }
                @case ('lock') {
                    <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
                }
                @case ('lock-open') {
                    <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2" />
                }
            }
        </svg>
    `,
    styles: `
        :host {
            display: inline-flex;
            width: 22px;
            height: 22px;
            flex: none;
        }

        svg {
            width: 100%;
            height: 100%;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellSidebarIconComponent {
    readonly name = input.required<WorkspaceSidebarIconName>();
    readonly filled = input(false);
}
