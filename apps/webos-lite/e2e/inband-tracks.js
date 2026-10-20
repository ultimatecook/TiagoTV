/* Runs before the app in the smoke run: stands in for a TV engine that
   exposes a file's embedded (in-band) subtitle tracks. Desktop Chromium
   never lists the subtitles inside a WebM, MKV or MP4, so `textTracks`
   is replaced by a list that gets two tracks (English, Spanish) when an
   episode number 2 loads ("/series/<user>/<pass>/<id ending in 2>.<ext>"),
   and loses them when the source is emptied, as an engine does. The app
   uses no <track> elements, so the real list has nothing to lose.
   window.__inband.modes() reports each track's mode for the checks. */
(function () {
    var PATTERN = /\/series\/[^/]+\/[^/]+\/\d*2\.\w+(\?|$)/;
    var lists = new WeakMap();
    var all = [];

    function Listeners() {
        this.map = {};
    }
    Listeners.prototype.add = function (type, fn) {
        (this.map[type] = this.map[type] || []).push(fn);
    };
    Listeners.prototype.remove = function (type, fn) {
        var list = this.map[type] || [];
        var index = list.indexOf(fn);
        if (index >= 0) {
            list.splice(index, 1);
        }
    };
    Listeners.prototype.fire = function (type, target) {
        (this.map[type] || []).slice().forEach(function (fn) {
            fn.call(target, { type: type, target: target });
        });
    };

    function cueList(cues) {
        var list = { length: cues.length };
        cues.forEach(function (cue, index) {
            list[index] = cue;
        });
        return list;
    }

    function FakeTrack(list, language, label, prefix) {
        var cues = [];
        for (var start = 0; start < 60; start += 2) {
            cues.push({ startTime: start, endTime: start + 1.8, text: prefix + ' ' + (start / 2 + 1) });
        }
        var listeners = new Listeners();
        var mode = 'disabled';
        var active = '';
        this.kind = 'subtitles';
        this.language = language;
        this.label = label;
        this.id = language;
        this.addEventListener = function (type, fn) {
            listeners.add(type, fn);
        };
        this.removeEventListener = function (type, fn) {
            listeners.remove(type, fn);
        };
        Object.defineProperty(this, 'mode', {
            get: function () {
                return mode;
            },
            set: function (value) {
                if (value !== mode) {
                    mode = value;
                    setTimeout(function () {
                        list.listeners.fire('change', list);
                    }, 0);
                }
            },
        });
        Object.defineProperty(this, 'cues', {
            get: function () {
                return mode === 'disabled' ? null : cueList(cues);
            },
        });
        var self = this;
        this.tick = function (time) {
            if (mode === 'disabled') {
                return;
            }
            var now = cues.filter(function (cue) {
                return cue.startTime <= time && cue.endTime > time;
            });
            var key = now.map(function (cue) {
                return cue.text;
            }).join('|');
            if (key !== active) {
                active = key;
                listeners.fire('cuechange', self);
            }
        };
    }

    function FakeList(media) {
        var self = this;
        this.length = 0;
        this.tracks = [];
        this.listeners = new Listeners();
        this.addEventListener = function (type, fn) {
            self.listeners.add(type, fn);
        };
        this.removeEventListener = function (type, fn) {
            self.listeners.remove(type, fn);
        };
        media.addEventListener('loadedmetadata', function () {
            if (self.length === 0 && PATTERN.test(media.currentSrc || '')) {
                self.set([new FakeTrack(self, 'en', 'English', '[EN] Line'), new FakeTrack(self, 'es', 'Español', '[ES] Línea')]);
            }
        });
        media.addEventListener('emptied', function () {
            if (self.length > 0) {
                self.set([]);
            }
        });
        media.addEventListener('timeupdate', function () {
            self.tracks.forEach(function (track) {
                track.tick(media.currentTime);
            });
        });
    }
    FakeList.prototype.set = function (tracks) {
        var old = this.tracks;
        for (var i = 0; i < old.length; i++) {
            delete this[i];
        }
        this.tracks = tracks;
        this.length = tracks.length;
        for (var j = 0; j < tracks.length; j++) {
            this[j] = tracks[j];
        }
        all = tracks;
        var self = this;
        setTimeout(function () {
            self.listeners.fire(tracks.length > 0 ? 'addtrack' : 'removetrack', self);
        }, 0);
    };

    Object.defineProperty(HTMLMediaElement.prototype, 'textTracks', {
        configurable: true,
        get: function () {
            var list = lists.get(this);
            if (!list) {
                list = new FakeList(this);
                lists.set(this, list);
            }
            return list;
        },
    });

    window.__inband = {
        modes: function () {
            return all.map(function (track) {
                return track.language + ':' + track.mode;
            }).join(' ');
        },
    };
})();
