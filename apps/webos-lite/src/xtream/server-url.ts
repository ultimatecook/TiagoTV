import { normalizeXtreamServerUrl } from '@iptvnator/shared/interfaces';

/**
 * The server address as the desktop app stores it (scheme, host, port and
 * path, without `player_api.php` or a trailing slash), from what the
 * viewer typed with the remote: "servidor.com:8080" gets `http://`.
 */
export function normalizeServerInput(input: string): string {
    const trimmed = String(input ?? '').trim();
    if (!trimmed) {
        throw new Error('Falta la dirección del servidor.');
    }
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `http://${trimmed}`;
    try {
        return normalizeXtreamServerUrl(withScheme);
    } catch {
        throw new Error(
            'La dirección del servidor no es válida (por ejemplo http://servidor.com:8080).'
        );
    }
}
