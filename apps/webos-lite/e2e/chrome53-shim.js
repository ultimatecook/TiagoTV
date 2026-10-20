/* Runs before the app in the smoke run: removes what desktop Chromium has
   and the LG TV's Chrome 53 does not, so a call to any of it fails here
   as it would on the TV. polyfills.js must put back the ones it promises. */
(function () {
    function drop(owner, name) {
        try {
            delete owner[name];
        } catch (error) {
            owner[name] = undefined;
        }
    }
    [
        'entries',
        'values',
        'fromEntries',
        'hasOwn',
        'getOwnPropertyDescriptors',
        'groupBy',
    ].forEach(function (name) {
        drop(Object, name);
    });
    ['padStart', 'padEnd', 'trimStart', 'trimEnd', 'replaceAll', 'matchAll', 'at'].forEach(
        function (name) {
            drop(String.prototype, name);
        }
    );
    ['flat', 'flatMap', 'at', 'findLast', 'findLastIndex', 'toSorted'].forEach(function (name) {
        drop(Array.prototype, name);
    });
    drop(Promise.prototype, 'finally');
    drop(Promise, 'allSettled');
    drop(Promise, 'any');
    ['structuredClone', 'queueMicrotask', 'AbortController', 'ResizeObserver'].forEach(
        function (name) {
            drop(window, name);
        }
    );
    [Element.prototype, Document.prototype, DocumentFragment.prototype].forEach(function (proto) {
        ['append', 'prepend', 'replaceChildren', 'replaceWith', 'toggleAttribute'].forEach(
            function (name) {
                drop(proto, name);
            }
        );
    });
    if (window.crypto) {
        drop(Object.getPrototypeOf(window.crypto), 'randomUUID');
    }
    window.__chrome53Shim = true;
})();
