/**
 * Colour helpers for what the desktop computes with color-mix() and
 * hsl() at run time: Chrome 53 has no color-mix, so the TV mixes here.
 */
function channels(hex: string): [number, number, number] {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.replace(/(.)/g, '$1$1') : value;
    const number = parseInt(full, 16) || 0;
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

/** `base` mixed with `share` of `other`, as rgba() with `alpha`. */
export function tint(base: string, other: string, share: number, alpha: number): string {
    const a = channels(base);
    const b = channels(other);
    const mix = a.map((value, index) => Math.round(value * (1 - share) + b[index] * share));
    return `rgba(${mix[0]},${mix[1]},${mix[2]},${alpha})`;
}

/** A stable hue for a name (the desktop's placeholder tints). */
export function hueOf(text: string): number {
    let sum = 0;
    for (let i = 0; i < text.length; i++) {
        sum = (sum * 31 + text.charCodeAt(i)) % 3600;
    }
    return sum % 360;
}
