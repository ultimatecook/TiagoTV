import { displayChannelName, displayTitle } from '@iptvnator/shared/interfaces';
import type { NowPlayingHandoff } from './now-playing-dock.service';

/** The bar's two lines. */
export interface NowPlayingHeading {
    readonly title: string;
    /** Null leaves the line to the live label, or empty. */
    readonly subtitle: string | null;
}

/**
 * What the bar names. A channel shows what it carries: an event channel
 * its match over the competition, any other its name without the
 * provider's country tag and quality badge. A film or episode shows the
 * title as the film or show is called.
 */
export function nowPlayingHeading(
    session: Pick<NowPlayingHandoff, 'title' | 'subtitle' | 'isLive'>
): NowPlayingHeading {
    if (!session.isLive) {
        return {
            title: displayTitle(session.title),
            subtitle: session.subtitle,
        };
    }
    const channel = displayChannelName(session.title);
    return {
        title: channel.title,
        subtitle: channel.subtitle ?? session.subtitle,
    };
}
