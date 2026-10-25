/* The smoke run's network faults, as webOS deals them to an app: before
   the app runs, requests whose URL ends with the text stored under
   `smoke:abort` are aborted just after they are sent (the TV cutting a
   request when the app goes to the background), and those ending with
   `smoke:stuck` are never sent at all, so no event ever reports on them.
   Nothing is logged: the URLs carry the account. ES5, like the app. */
(function () {
    var abortText = null;
    var stuckText = null;
    try {
        abortText = window.localStorage.getItem('smoke:abort');
        stuckText = window.localStorage.getItem('smoke:stuck');
    } catch (error) {
        return;
    }
    if (!abortText && !stuckText) {
        return;
    }
    function endsWith(text, end) {
        return !!end && text.length >= end.length && text.slice(-end.length) === end;
    }
    var open = XMLHttpRequest.prototype.open;
    var send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
        this.__smokeUrl = String(url);
        return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
        var url = this.__smokeUrl || '';
        var xhr = this;
        if (endsWith(url, stuckText)) {
            window.__smokeStuck = (window.__smokeStuck || 0) + 1;
            return undefined;
        }
        var result = send.apply(this, arguments);
        if (endsWith(url, abortText)) {
            window.__smokeAborted = (window.__smokeAborted || 0) + 1;
            setTimeout(function () {
                xhr.abort();
            }, 300);
        }
        return result;
    };
})();
