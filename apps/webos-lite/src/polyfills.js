/* TiagoTV liviano: built-ins Chrome 53 (LG webOS 4) lacks, added before the
   bundle runs (esbuild banner): the bundle's own helpers read
   Object.getOwnPropertyDescriptors when it starts. ES5 on purpose. */
(function () {
    function define(target, name, value) {
        if (typeof target[name] !== 'function') {
            Object.defineProperty(target, name, {
                value: value,
                configurable: true,
                writable: true,
                enumerable: false
            });
        }
    }
    define(Object, 'assign', function (target) {
        var to = Object(target);
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (source != null) {
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        to[key] = source[key];
                    }
                }
            }
        }
        return to;
    });
    define(Object, 'entries', function (object) {
        return Object.keys(object).map(function (key) {
            return [key, object[key]];
        });
    });
    define(Object, 'values', function (object) {
        return Object.keys(object).map(function (key) {
            return object[key];
        });
    });
    define(Object, 'getOwnPropertyDescriptors', function (object) {
        var result = {};
        var keys = Object.getOwnPropertyNames(object);
        if (Object.getOwnPropertySymbols) {
            keys = keys.concat(Object.getOwnPropertySymbols(object));
        }
        keys.forEach(function (key) {
            result[key] = Object.getOwnPropertyDescriptor(object, key);
        });
        return result;
    });
    function pad(text, length, fill, atStart) {
        var target = length >> 0;
        var filler = fill === undefined ? ' ' : String(fill);
        if (text.length >= target || filler === '') {
            return text;
        }
        var needed = target - text.length;
        while (filler.length < needed) {
            filler += filler;
        }
        filler = filler.slice(0, needed);
        return atStart ? filler + text : text + filler;
    }
    define(String.prototype, 'padStart', function (length, fill) {
        return pad(String(this), length, fill, true);
    });
    define(String.prototype, 'padEnd', function (length, fill) {
        return pad(String(this), length, fill, false);
    });
    define(Array.prototype, 'includes', function (value) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value || (value !== value && this[i] !== this[i])) {
                return true;
            }
        }
        return false;
    });
})();
