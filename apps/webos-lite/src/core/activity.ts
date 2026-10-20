/**
 * What the TV is doing with its video, which decides how much else may
 * run: images to download and catalog requests to send compete with the
 * stream for the TV's one slow CPU and its network.
 *
 *   idle        nothing plays: images and requests flow;
 *   preview     a stream plays in a page (En vivo): fewer images at once;
 *   fullscreen  the player covers everything: no new image downloads and
 *               no background requests until it closes.
 */
export type Activity = 'idle' | 'preview' | 'fullscreen';

type Listener = (activity: Activity) => void;

const listeners: Listener[] = [];
let current: Activity = 'idle';

export function activity(): Activity {
    return current;
}

export function setActivity(next: Activity): void {
    if (next === current) {
        return;
    }
    current = next;
    for (const listener of listeners.slice()) {
        listener(next);
    }
}

export function onActivity(listener: Listener): void {
    listeners.push(listener);
}
