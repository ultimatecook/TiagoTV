// Checks whether this TV can run the whole TiagoTV interface inside the
// app, without the TiagoTV server: direct requests to providers, a web
// engine recent enough for the Angular build and video support. ES5 on
// purpose, so it also reports on old webOS releases.
(function () {
    var TIMEOUT_MS = 10000;
    // Angular 22's browser support (baseline widely available).
    var MIN_CHROME = 119;
    // Neither answers with Access-Control-Allow-Origin, like most IPTV
    // providers: reading them means the app is not held to CORS.
    var TARGETS = [
        {
            label: 'http',
            url: 'http://example.com/',
            expect: 'Example Domain',
        },
        {
            label: 'https',
            url: 'https://developer.lge.com/secure/CheckDevModeSession.dev?sessionToken=tiagotv-probe',
            expect: '"result"',
        },
    ];
    var SYNTAX = {
        'async/await': 'async function f() { await 1; }',
        '?. y ??': 'var a = null; return a?.b ?? 1;',
        '??=': 'var a; a ??= 1;',
        'class fields': 'class A { x = 1; static y = 2; }',
        'private fields': 'class A { #x = 1; m() { return #x in this; } }',
        'static blocks': 'class A { static {} }',
    };
    var APIS = {
        'Array.at': function () {
            return !!Array.prototype.at;
        },
        'Array.findLast': function () {
            return !!Array.prototype.findLast;
        },
        'Array.toSorted': function () {
            return !!Array.prototype.toSorted;
        },
        'Object.hasOwn': function () {
            return !!Object.hasOwn;
        },
        'Object.groupBy': function () {
            return !!Object.groupBy;
        },
        'Promise.withResolvers': function () {
            return !!Promise.withResolvers;
        },
        structuredClone: function () {
            return typeof structuredClone === 'function';
        },
        'CSS :has()': function () {
            return CSS.supports('selector(:has(a))');
        },
        'CSS container queries': function () {
            return CSS.supports('container-type: inline-size');
        },
    };

    function withTimeout(promise) {
        return new Promise(function (resolve) {
            var timer = setTimeout(function () {
                resolve(false);
            }, TIMEOUT_MS);
            promise.then(
                function (ok) {
                    clearTimeout(timer);
                    resolve(ok);
                },
                function () {
                    clearTimeout(timer);
                    resolve(false);
                }
            );
        });
    }

    function readWithFetch(target) {
        if (typeof fetch !== 'function') {
            return Promise.resolve(false);
        }
        return withTimeout(
            fetch(target.url, { cache: 'no-store' })
                .then(function (response) {
                    return response.text();
                })
                .then(function (text) {
                    return text.indexOf(target.expect) !== -1;
                })
        );
    }

    function readWithXhr(target) {
        return withTimeout(
            new Promise(function (resolve) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', target.url);
                xhr.onload = function () {
                    resolve(
                        String(xhr.responseText).indexOf(target.expect) !== -1
                    );
                };
                xhr.onerror = function () {
                    resolve(false);
                };
                xhr.send();
            })
        );
    }

    function missingFeatures() {
        var missing = [];
        var name;
        for (name in SYNTAX) {
            try {
                new Function(SYNTAX[name]);
            } catch (error) {
                missing.push(name);
            }
        }
        for (name in APIS) {
            var ok;
            try {
                ok = APIS[name]();
            } catch (error) {
                ok = false;
            }
            if (!ok) {
                missing.push(name);
            }
        }
        return missing;
    }

    function chromeVersion() {
        var match = /Chrome\/(\d+)/.exec(navigator.userAgent);
        return match ? Number(match[1]) : 0;
    }

    function videoSupport() {
        var video = document.createElement('video');
        var mse =
            !!window.MediaSource &&
            MediaSource.isTypeSupported(
                'video/mp4; codecs="avc1.42E01E,mp4a.40.2"'
            );
        var hls = !!video.canPlayType('application/vnd.apple.mpegurl');
        return { mse: mse, hls: hls };
    }

    function mark(ok) {
        return ok ? '✅' : '❌';
    }

    function line(text) {
        var p = document.createElement('p');
        p.style.margin = '8px 0';
        p.textContent = text;
        return p;
    }

    function run() {
        var checks = [];
        TARGETS.forEach(function (target) {
            checks.push(readWithFetch(target), readWithXhr(target));
        });
        Promise.all(checks).then(function (read) {
            var results = document.getElementById('results');
            var http = read[0] || read[1];
            var https = read[2] || read[3];
            var direct = http && https;
            var chrome = chromeVersion();
            var missing = missingFeatures();
            var engineOk = chrome >= MIN_CHROME && missing.length === 0;
            var video = videoSupport();

            results.textContent = '';
            results.appendChild(
                line(
                    '1. Conexión directa (http): ' +
                        mark(http) +
                        '  fetch ' +
                        mark(read[0]) +
                        ' XHR ' +
                        mark(read[1])
                )
            );
            results.appendChild(
                line(
                    '2. Conexión directa (https): ' +
                        mark(https) +
                        '  fetch ' +
                        mark(read[2]) +
                        ' XHR ' +
                        mark(read[3])
                )
            );
            results.appendChild(
                line(
                    '3. Motor web: Chrome ' +
                        (chrome || '?') +
                        ' ' +
                        (engineOk ? '✅' : '⚠️') +
                        (missing.length ? '  falta: ' + missing.join(', ') : '')
                )
            );
            results.appendChild(
                line(
                    '4. Video: MSE ' +
                        mark(video.mse) +
                        '  HLS nativo ' +
                        mark(video.hls)
                )
            );

            var verdict;
            if (!direct) {
                verdict =
                    '❌ La tele no deja conectarse directo: TiagoTV necesita el servidor.';
            } else if (engineOk) {
                verdict = '✅ TiagoTV entero puede andar en esta tele.';
            } else {
                verdict =
                    '⚠️ Se puede, adaptando la compilación a este motor web.';
            }
            var result = line(verdict);
            result.style.fontSize = '36px';
            result.style.marginTop = '32px';
            results.appendChild(result);
            results.appendChild(
                line('Sacale una foto a esta pantalla y mandámela.')
            );
            document.getElementById('agent').textContent = navigator.userAgent;
        });
    }

    run();
})();
