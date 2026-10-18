// Opens the TiagoTV server the package was built for (server.js) once it
// answers, retrying while it is off. ES5 on purpose: older webOS releases
// run old Chromium versions.
(function () {
    var RETRY_MS = 5000;
    var TIMEOUT_MS = 8000;
    var server = window.TIAGOTV_SERVER;
    var status = document.getElementById('status');

    function reachable() {
        return new Promise(function (resolve) {
            var timer = setTimeout(function () {
                resolve(false);
            }, TIMEOUT_MS);
            // An opaque answer is enough: it means the server is up.
            fetch(server + '/api/health', {
                mode: 'no-cors',
                cache: 'no-store',
            }).then(
                function () {
                    clearTimeout(timer);
                    resolve(true);
                },
                function () {
                    clearTimeout(timer);
                    resolve(false);
                }
            );
        });
    }

    function connect() {
        status.textContent = 'Conectando con ' + server + '…';
        reachable().then(function (ok) {
            if (ok) {
                location.replace(server + '/');
                return;
            }
            status.textContent =
                'No se pudo conectar con ' + server + '. Reintentando…';
            setTimeout(connect, RETRY_MS);
        });
    }

    if (!server) {
        status.textContent =
            'Falta la dirección del servidor: empaquetá la app con tools/tiagotv/webos.mjs.';
        return;
    }
    connect();
})();
