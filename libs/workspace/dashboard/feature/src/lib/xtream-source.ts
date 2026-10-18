import type { PlaylistMeta } from '@iptvnator/shared/interfaces';

export interface XtreamSourceCredentials {
    readonly serverUrl: string;
    readonly username: string;
    readonly password: string;
}

/** TiagoTV follows one provider: the first Xtream source. */
export function primaryXtreamSource(
    playlists: readonly PlaylistMeta[]
): PlaylistMeta | null {
    return (
        playlists.find(
            (playlist) =>
                !!playlist.serverUrl &&
                !!playlist.username &&
                !!playlist.password
        ) ?? null
    );
}

export function xtreamSourceCredentials(
    source: PlaylistMeta
): XtreamSourceCredentials {
    return {
        serverUrl: source.serverUrl as string,
        username: source.username as string,
        password: source.password as string,
    };
}
