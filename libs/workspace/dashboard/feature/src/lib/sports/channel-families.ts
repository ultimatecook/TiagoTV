import type {
    ChannelFamily as SharedChannelFamily,
    ChannelFeed as SharedChannelFeed,
} from '@iptvnator/portal/shared/util';
import type { SportChannel } from './sports-catalog';

/**
 * TiagoTV sports: channel families (one brand, its numbered feeds, each
 * feed's copies). The rules live in `@iptvnator/portal/shared/util`, which
 * the live player's "other feeds" strip reads too; the sports views group
 * their own channels with them.
 */
export {
    channelFamilyName,
    feedTitle,
    groupChannelFamilies,
    hasWhiteLogo,
    parseChannelName,
    type ChannelNameParts,
} from '@iptvnator/portal/shared/util';

export type ChannelFamily = SharedChannelFamily<SportChannel>;
export type ChannelFeed = SharedChannelFeed<SportChannel>;
