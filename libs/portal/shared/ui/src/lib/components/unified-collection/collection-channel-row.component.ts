import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
    buildLiveChannelPlayTarget,
    buildLiveCollectionNavigationTarget,
    channelFace,
    UnifiedCollectionItem,
} from '@iptvnator/portal/shared/util';
import {
    foldSearchText,
    isCatalogUnavailable,
} from '@iptvnator/shared/interfaces';

/**
 * TiagoTV's Mi lista: its live channels as a row of cards, before the
 * movies and series. A card shows the channel's logo on a dark plate (its
 * name in Bebas without one) and its country's flag, as the Home's last
 * channels do (`channelFace`). A click plays it on "En vivo" (an Xtream
 * channel, `buildLiveChannelPlayTarget`; one no country lists goes on to
 * the live view) or, from an M3U or Stalker source, in that source's own
 * favourites, which open on it playing. The red heart takes it off.
 */
@Component({
    selector: 'app-collection-channel-row',
    imports: [MatIcon, TranslatePipe],
    templateUrl: './collection-channel-row.component.html',
    styleUrl: './collection-channel-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionChannelRowComponent {
    readonly items = input.required<readonly UnifiedCollectionItem[]>();
    /** The shell's search, as the grids below filter by it. */
    readonly searchTerm = input('');
    readonly removeItem = output<UnifiedCollectionItem>();

    private readonly router = inject(Router);
    private readonly failedLogos = signal<ReadonlySet<string>>(new Set());

    /** The source under each name, when the channels come from several. */
    readonly showSource = computed(
        () => new Set(this.items().map((item) => item.playlistId)).size > 1
    );
    readonly channels = computed(() => {
        const term = foldSearchText(this.searchTerm().trim());
        const failed = this.failedLogos();
        const usable = (url: string | null | undefined) =>
            url && !failed.has(url) ? url : null;
        return this.items()
            .filter((item) => !term || foldSearchText(item.name).includes(term))
            .map((item) => {
                const face = channelFace(item.name, item.logo);
                return {
                    item,
                    name: face.name,
                    flag: face.flag,
                    // The brand's logo, else the provider's, else the name.
                    logo: usable(face.logo) ?? usable(item.logo),
                    unavailable: isCatalogUnavailable(item),
                };
            });
    });

    play(item: UnifiedCollectionItem): void {
        if (isCatalogUnavailable(item)) {
            return;
        }
        const target =
            buildLiveChannelPlayTarget(item) ??
            buildLiveCollectionNavigationTarget({
                mode: 'favorites',
                sourceType: item.sourceType,
                playlistId: item.playlistId,
                itemId:
                    item.stalkerId ??
                    item.streamUrl ??
                    item.channelId ??
                    item.xtreamId,
                title: item.name,
                imageUrl: item.logo ?? null,
            });
        void this.router.navigate(target.link, { state: target.state });
    }

    logoFailed(url: string): void {
        this.failedLogos.update((failed) => new Set(failed).add(url));
    }
}
