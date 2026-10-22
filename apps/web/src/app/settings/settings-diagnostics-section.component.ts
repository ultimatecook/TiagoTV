import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DOCUMENT,
    EnvironmentInjector,
    inject,
    input,
    signal,
    ViewEncapsulation,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import type {
    CatalogDiagnosticsService,
    CatalogRequestEntry,
} from '@iptvnator/workspace/dashboard/feature';

/** Written next to the interface's index.html by its over-the-air build. */
const UI_STAMP = 'tiagotv-ui.json';

/**
 * Ajustes → Diagnóstico: the app and interface build, what Series,
 * Películas and Buscar are built from (the stored catalog, each platform's
 * list, what shows), and the catalog's last provider requests — action,
 * category, time and outcome, never an address or the account. "Reload
 * catalog" forgets the platforms' saved lists and asks for them again.
 * The catalog lives in the lazy-loaded dashboard feature: its service is
 * reached once that chunk arrives.
 */
@Component({
    selector: 'app-settings-diagnostics-section',
    imports: [
        DatePipe,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
    ],
    templateUrl: './settings-diagnostics-section.component.html',
    styleUrls: ['./settings-diagnostics-section.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDiagnosticsSectionComponent {
    private readonly document = inject(DOCUMENT);
    private readonly service = signal<CatalogDiagnosticsService | null>(null);

    readonly version = input('');
    readonly buildCommit = input('');
    /** The over-the-air interface build, where its stamp can be read. */
    readonly uiBuild = signal<number | null>(null);
    /** The interface bundle's hash: which build runs, in any case. */
    readonly bundle = bundleHash(this.document);

    readonly kinds = computed(() => this.service()?.kinds() ?? []);
    readonly requests = computed(() => this.service()?.requests() ?? []);
    readonly reloading = computed(() => !!this.service()?.reloading());
    readonly hasSource = computed(() => !!this.service()?.hasSource());
    readonly pendingRetries = computed(
        () => this.service()?.pendingRetries() ?? 0
    );

    constructor() {
        const injector = inject(EnvironmentInjector);
        void import('@iptvnator/workspace/dashboard/feature')
            .then(({ CatalogDiagnosticsService }) => {
                const service = injector.get(CatalogDiagnosticsService);
                this.service.set(service);
                void service.read();
            })
            .catch(() => undefined);
        void readUiStamp().then((build) => this.uiBuild.set(build));
    }

    reload(): void {
        void this.service()?.reload();
    }

    resultKey(entry: CatalogRequestEntry): string {
        return `SETTINGS.DIAGNOSTICS.RESULT.${entry.result.toUpperCase()}`;
    }

    statusKey(status: string): string {
        const known = [
            'completed',
            'failed',
            'cancelled',
            'idle',
            'importing',
        ].includes(status);
        return `SETTINGS.DIAGNOSTICS.STATUS.${known ? status.toUpperCase() : 'UNKNOWN'}`;
    }

    stateKey(state: string): string {
        return `SETTINGS.DIAGNOSTICS.STATE.${state.toUpperCase()}`;
    }

    seconds(ms: number): string {
        return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
    }
}

function bundleHash(document: Document): string | null {
    const scripts = [...document.querySelectorAll('script[src]')];
    for (const script of scripts) {
        const match = /(?:^|\/)main[-.]([A-Za-z0-9]{6,})\.js$/.exec(
            script.getAttribute('src') ?? ''
        );
        if (match) {
            return match[1].slice(0, 8);
        }
    }
    return null;
}

/** The stamp's build number; null where it cannot be read (dev, file://). */
function readUiStamp(): Promise<number | null> {
    return new Promise((resolve) => {
        try {
            const request = new XMLHttpRequest();
            request.open('GET', UI_STAMP);
            request.responseType = 'json';
            request.onload = () => {
                const build = (request.response as { build?: unknown } | null)
                    ?.build;
                resolve(Number.isInteger(build) ? (build as number) : null);
            };
            request.onerror = () => resolve(null);
            request.send();
        } catch {
            resolve(null);
        }
    });
}
