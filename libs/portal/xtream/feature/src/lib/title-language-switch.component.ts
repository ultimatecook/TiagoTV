import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TitlePlatformStore } from '@iptvnator/services';
import { MetaChipComponent } from '@iptvnator/ui/components';

/**
 * "EN · ES" in a title page's tags when the catalog files the title in
 * both languages: the version on screen as text, the other one opening
 * its page. The catalog opens the English version, the original, unless
 * Settings → Playback → Audio language asks for the Spanish dub; this is
 * the way to the other one.
 */
@Component({
    selector: 'app-title-language-switch',
    imports: [MetaChipComponent, TranslateModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { style: 'display: contents' },
    template: `
        @if (versions().length > 1) {
            <app-meta-chip data-test-id="title-language-switch">
                @for (version of versions(); track version.language) {
                    @if (!$first) {
                        <span class="meta-chip__sep" aria-hidden="true"
                            >·</span
                        >
                    }
                    @if (version.current) {
                        <span
                            aria-current="true"
                            [attr.title]="
                                'WORKSPACE.PLATFORMS.LANGUAGE.' +
                                    version.language | translate
                            "
                            >{{ version.language }}</span
                        >
                    } @else {
                        <button
                            type="button"
                            class="meta-chip__facet"
                            [attr.data-test-id]="
                                'title-language-' + version.language
                            "
                            [attr.aria-label]="
                                'WORKSPACE.PLATFORMS.WATCH_IN'
                                    | translate
                                        : {
                                              language:
                                                  'WORKSPACE.PLATFORMS.LANGUAGE.' +
                                                      version.language
                                                  | translate,
                                          }
                            "
                            [attr.title]="
                                'WORKSPACE.PLATFORMS.WATCH_IN'
                                    | translate
                                        : {
                                              language:
                                                  'WORKSPACE.PLATFORMS.LANGUAGE.' +
                                                      version.language
                                                  | translate,
                                          }
                            "
                            (click)="version.open()"
                        >
                            {{ version.language }}
                        </button>
                    }
                }
            </app-meta-chip>
        }
    `,
})
export class TitleLanguageSwitchComponent {
    readonly versions = inject(TitlePlatformStore).versions;
}
