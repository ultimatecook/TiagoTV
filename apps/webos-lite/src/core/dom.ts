import { cancelImage, queueImage } from './image-queue';

/**
 * A few DOM helpers instead of a framework: the TV renders a handful of
 * rows at a time, and every byte of script costs start-up time on it.
 * Chrome 53 has no `append()`/`prepend()`: everything goes through
 * `appendChild`.
 */
export type Child = Node | string | number | null | undefined | false;

export interface Props {
    readonly className?: string;
    readonly text?: string;
    readonly attrs?: Readonly<Record<string, string>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props?: Props | string | null,
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    const options: Props =
        typeof props === 'string' ? { className: props } : (props ?? {});
    if (options.className) {
        el.className = options.className;
    }
    if (options.text !== undefined) {
        el.textContent = options.text;
    }
    if (options.attrs) {
        for (const name of Object.keys(options.attrs)) {
            el.setAttribute(name, options.attrs[name]);
        }
    }
    appendChildren(el, children);
    return el;
}

export function appendChildren(parent: Node, children: readonly Child[]): void {
    for (const child of children) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        parent.appendChild(
            typeof child === 'object'
                ? child
                : document.createTextNode(String(child))
        );
    }
}

export function clear(el: Node): void {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

export function detach(el: Node | null | undefined): void {
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

/**
 * An image that gives way to `fallback` text when it fails (a provider's
 * dead logo link): the card shows the name instead of a broken icon.
 */
export function picture(
    src: string | null,
    className: string,
    fallback: string,
    urgent = false
): HTMLElement {
    const box = h('div', `${className} pic`);
    const label = h('span', { className: 'pic__fallback', text: fallback });
    box.appendChild(label);
    if (src) {
        const img = h('img', { className: 'pic__img', attrs: { alt: '' } });
        img.onerror = () => {
            box.className += ' is-broken';
            img.removeAttribute('src');
        };
        img.onload = () => {
            box.className += ' is-loaded';
        };
        queueImage(img, src, urgent);
        box.appendChild(img);
    } else {
        box.className += ' is-broken';
    }
    return box;
}

/** Drops an image's download when its card leaves the window. */
export function releaseImages(el: Element): void {
    const images = el.getElementsByTagName('img');
    for (let i = 0; i < images.length; i++) {
        images[i].onload = null;
        images[i].onerror = null;
        cancelImage(images[i]);
        images[i].removeAttribute('src');
    }
}

export function toggleClass(el: Element, name: string, on: boolean): void {
    if (on) {
        el.classList.add(name);
    } else {
        el.classList.remove(name);
    }
}
