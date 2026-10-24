import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
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
    sourceDisplayLabel,
} from '@iptvnator/shared/interfaces';

/**
 * TiagoTV's Mi lista and Recently viewed: their live channels as a row of
 * cards, before the movies and series. A card shows the channel's logo on
 * a dark plate (its name in Bebas without one) and its country's flag, as
 * the Home's last channels do (`channelFace`). A click plays it on "En
 * vivo" (an Xtream channel, `buildLiveChannelPlayTarget`; one no country
 * lists, or another source's, goes on to the live view) or, from an M3U or
 * Stalker source, in that source's own favourites or recent items, which
 * open on it playing. On Mi lista the red heart takes it off; on Recently
 * viewed a card's × takes it out of the history and the bin beside the
 * title clears every channel.
 */
@Component({
    selector: 'app-collection-channel-row',
    imports: [MatIcon, MatIconButton, MatTooltip, TranslatePipe],
    templateUrl: './collection-channel-row.component.html',
    styleUrl: './collection-channel-row.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionChannelRowComponent {
    readonly items = input.required<readonly UnifiedCollectionItem[]>();
    /** Mi lista's favourites, or the recently viewed channels. */
    readonly mode = input<'favorites' | 'recent'>('favorites');
    /** The shell's search, as the grids below filter by it. */
    readonly searchTerm = input('');
    readonly removeItem = output<UnifiedCollectionItem>();
    /** Recently viewed's bin: clear every channel (the page confirms). */
    readonly clearAll = output<void>();

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
                    // Never the provider's address: the user's own name
                    // for the source, else its kind ("Xtream").
                    source: sourceDisplayLabel(
                        item.playlistName,
                        item.sourceType
                    ),
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
                mode: this.mode(),
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
