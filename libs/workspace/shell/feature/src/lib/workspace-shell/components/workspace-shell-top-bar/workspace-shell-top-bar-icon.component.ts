import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type WorkspaceTopBarIconName =
    | 'search'
    | 'settings'
    | 'back'
    | 'close'
    | 'menu'
    | 'download'
    | 'lock'
    | 'lock-open';

/**
 * The top bar's line glyphs (24px grid, 1.6px stroke, as the design draws
 * them). The Material ligature font has no outlined set loaded, and the
 * glass circles want the lighter line weight.
 */
@Component({
    selector: 'app-workspace-shell-top-bar-icon',
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
                @case ('search') {
                    <circle cx="11" cy="11" r="6.6" />
                    <path d="m20 20-4.3-4.3" />
                }
                @case ('settings') {
                    <circle cx="12" cy="12" r="3" />
                    <path
                        d="M12.2 2.5h-.4a1.9 1.9 0 0 0-1.9 1.9v.2a1.9 1.9 0 0 1-1 1.6l-.4.2a1.9 1.9 0 0 1-1.9 0l-.1-.1a1.9 1.9 0 0 0-2.6.7l-.2.4a1.9 1.9 0 0 0 .7 2.6l.1.1a1.9 1.9 0 0 1 1 1.6v.5a1.9 1.9 0 0 1-1 1.7l-.1.1a1.9 1.9 0 0 0-.7 2.6l.2.4a1.9 1.9 0 0 0 2.6.7l.1-.1a1.9 1.9 0 0 1 1.9 0l.4.2a1.9 1.9 0 0 1 1 1.6v.2a1.9 1.9 0 0 0 1.9 1.9h.4a1.9 1.9 0 0 0 1.9-1.9v-.2a1.9 1.9 0 0 1 1-1.6l.4-.2a1.9 1.9 0 0 1 1.9 0l.1.1a1.9 1.9 0 0 0 2.6-.7l.2-.4a1.9 1.9 0 0 0-.7-2.6l-.1-.1a1.9 1.9 0 0 1-1-1.7v-.5a1.9 1.9 0 0 1 1-1.6l.1-.1a1.9 1.9 0 0 0 .7-2.6l-.2-.4a1.9 1.9 0 0 0-2.6-.7l-.1.1a1.9 1.9 0 0 1-1.9 0l-.4-.2a1.9 1.9 0 0 1-1-1.6v-.2a1.9 1.9 0 0 0-1.9-1.9z"
                    />
                }
                @case ('back') {
                    <path stroke-width="1.8" d="m15 6-6 6 6 6" />
                }
                @case ('close') {
                    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
                }
                @case ('menu') {
                    <path d="M4.5 7h15M4.5 12h15M4.5 17h9" />
                }
                @case ('download') {
                    <path
                        d="M12 3.8v11.4m0 0 4.6-4.6M12 15.2l-4.6-4.6M5 20h14"
                    />
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
            flex: none;
            width: 19px;
            height: 19px;
        }

        svg {
            width: 100%;
            height: 100%;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShellTopBarIconComponent {
    readonly name = input.required<WorkspaceTopBarIconName>();
}
