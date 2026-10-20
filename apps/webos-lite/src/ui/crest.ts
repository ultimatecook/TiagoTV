import type { SportSectionId } from '@iptvnator/workspace/dashboard/feature/tv-logic';
import { detach, h } from '../core/dom';
import { queueImage } from '../core/image-queue';
import { crestBook } from '../data/crests';

/**
 * A team's crest, as the desktop's: its initials on a disc until the
 * crest is known (data/crests.ts), then the crest itself; an image that
 * fails to load leaves the initials.
 */
export function initials(name: string): string {
    const words = name.split(/[\s\-.'’&()/]+/).filter((word) => word.length > 0);
    const significant = words.filter((word) => !/^(fc|cf|cd|rc|ud|sd|afc|ac|club|de|del|la)$/i.test(word));
    const pick = significant.length > 0 ? significant : words;
    return pick
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

function showImage(el: HTMLElement, url: string): void {
    const img = h('img', { className: 'crest__img', attrs: { alt: '' } });
    img.onload = () => el.classList.add('crest--image');
    img.onerror = () => {
        el.classList.remove('crest--image');
        detach(img);
    };
    el.appendChild(img);
    queueImage(img, url);
}

export function crest(name: string, className = 'crest', section: SportSectionId | null = null): HTMLElement {
    const el = h('span', { className, text: initials(name) });
    const book = crestBook();
    const known = book.known(name, section);
    if (known) {
        showImage(el, known);
    } else if (known === undefined) {
        void book.resolve(name, section).then((url) => {
            if (url) {
                showImage(el, url);
            }
        });
    }
    return el;
}
