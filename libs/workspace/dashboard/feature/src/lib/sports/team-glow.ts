import { teamKey } from './team-names';

/**
 * A side's colour for the glow behind it on a competition's page. The
 * catalog knows no club colours, so each club keeps a hue of its own,
 * from its name (the same however a feed spells it).
 */
export function teamGlow(name: string | null | undefined): string {
    const key = name ? teamKey(name) : '';
    let hue = 0;
    for (const char of key) {
        hue = (hue * 31 + char.charCodeAt(0)) % 360;
    }
    return `hsl(${hue} 45% 32%)`;
}
