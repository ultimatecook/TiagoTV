# TiagoTV for Android TV

A sideloadable Android TV app (package `com.tiagotv.androidtv`, "TiagoTV")
that shows TiagoTV liviano, the TV app in [`apps/webos-lite`](../webos-lite),
and plays its streams in a native player. Built for a Hisense PX1-PRO
projector running Android TV; it works from Android 9 (API 28) up with a
Play-Store-updated WebView. The Spanish install guide for the viewer is
[`docs/tiagotv-androidtv-instalar.md`](../../docs/tiagotv-androidtv-instalar.md).

## Architecture

One Activity (`MainActivity`) with two views on top of each other:

- **`PlayerView`** (Media3 / ExoPlayer) at the bottom, full screen, no
  controller of its own. It plays HLS, MPEG-TS and files (MP4, MKV) and
  draws embedded subtitles with its `SubtitleView` (white on a dark band,
  large, like the page's own cues).
- **`WebView`** on top, transparent, showing the web bundle from
  `app/src/main/assets/www` through `WebViewAssetLoader`
  (`https://appassets.androidplatform.net/assets/www/index.html`), so
  `localStorage` (the viewer's server, user, lists, preferences) persists
  in the app's data. While a stream plays, the page clears its own
  backgrounds (`html.is-native-video`, `player.css`) and the native picture
  shows through; the page's OSD, menus and dialogs draw over it.

### The page's size

The page draws a fixed 1920×1080 canvas (its viewport meta, `width=1920`)
and scales it to the screen itself, centred, letterboxed on another
shape (`apps/webos-lite/src/core/fit.ts`). `PageViewport` sets the
WebView to lay it out at that width whatever the screen
(`useWideViewPort`, `loadWithOverviewMode`), keeps the system's font-size
setting out of it (`textZoom = 100`) and disables zoom; `PageViewportTest`
checks those settings without a WebView.

### The provider's requests (CORS)

The page lives on an `https://appassets…` origin and the Xtream panels are
plain `http://` without CORS headers, so the WebView would refuse the
page's `XMLHttpRequest`s. `ProviderProxy` intercepts every other http(s)
GET/HEAD the page makes (`shouldInterceptRequest`), performs it with
`HttpURLConnection` on the WebView's worker thread (the page's own
`User-Agent`, redirects followed, long read timeout) and hands the answer
back with `Access-Control-Allow-Origin: *`. Mixed content is allowed for
the same reason. Nothing is logged or cached: the URLs carry the account.
This keeps the web app unchanged (it reaches the panel exactly as it does
from `file://` on LG) and avoids the deprecated
`setAllowUniversalAccessFromFileURLs`. The native player makes its own
requests and is not affected.

### The remote

The D-pad, OK, the digits and Page Up/Down reach the page as DOM key
events from the WebView itself. Back, CH+/CH−, the media keys, Info and
Next/Previous do not, so `MainActivity.dispatchKeyEvent` hands them to the
page as the LG remote's key codes (`RemoteKeys`, matching
`apps/webos-lite/src/core/keys.ts`) through
`window.__tiagotvNativeKey(code)`. The page answers whether it took the
key; the Activity finishes only when the page did **not** take Back
(the page shows its own "¿Salir de TiagoTV?" dialog on the root screen and
calls `TiagoTVNative.exit()` to close). Volume keys stay with the system.

### The playback bridge

`window.TiagoTVNative` (`NativeBridge`, `addJavascriptInterface`) exposes
`play(url, kind, startAt)`, `pause`, `resume`, `seek`, `stop`, `setVolume`,
`setProfile`, `selectAudio`, `selectSubtitle`, `setSubtitlesRaised` and
`exit`; every call is posted to the main thread in order. `PlayerHost`
owns the one ExoPlayer and reports through
`window.__tiagotvNativeEvent({type, …})`: `tracks`, `ready`, `playing`,
`waiting`, `paused`, `ended`, `error` (with the HTTP status a refused
stream failed with, so the page's busy/missing logic works), `timeupdate`
(twice a second) and `seeked`. A stream the panel refuses before it
starts (a 4xx) fails at once, without ExoPlayer's retries, so the page
sees the status within its own attempt timeout; once a stream plays, the
default retries ride over a transient segment error. Events are built by `BridgeEvents` as
JavaScript literals, never carrying a URL.

On the page, `src/player/native-media.ts` is a stand-in for the `<video>`
element (currentTime, duration, paused, play/pause, `textTracks`,
`audioTracks`, the media events) fed by those events, and the engine's
`android` candidates (`src/player/sources.ts`) start and stop streams
through it. The engine's rules are unchanged: one connection at a time
(`stop` before every `play`, and `PlayerHost.play` stops and clears the
player before it prepares), the candidates' order by "Fluidez" (Más
estable: HLS then TS; Normal: TS then HLS; never MSE), the busy retries and
the stall watch. "Más estable" also builds the player with larger buffers
(`DefaultLoadControl`: starts with 5 s in, keeps up to 3 min ahead);
"Normal" uses ExoPlayer's defaults.

### Subtitles and audio

The player's embedded tracks arrive in the `tracks` event with ids
`a:<group>:<track>` / `t:<group>:<track>` and appear in the page's
"Subtítulos" and "Audio" menus beside the provider's subtitle files. An
embedded subtitle track the page chooses is selected in ExoPlayer and
drawn natively by `SubtitleView` (the page draws nothing for it; the OSD
raises it while the progress bar shows). A provider's `.srt`/`.vtt` file
is still downloaded and drawn by the page, with the native selection
cleared. Audio is switched with a track-selection override, in place.

## Build

Needs a JDK 17+, Gradle 8.9+ on the PATH (or run `gradle wrapper` once in
this folder) and an Android SDK with platforms 35 and build-tools 34
(`ANDROID_HOME`, or `local.properties` with `sdk.dir=`):

```bash
pnpm nx build androidtv                # web bundle → assets, then assembleRelease
pnpm nx build androidtv -c debug       # assembleDebug
pnpm nx test androidtv                 # Kotlin unit tests (keys, events, proxy)
pnpm nx smoke androidtv                # the page's bridge, with a fake bridge in Chromium
node apps/androidtv/tools/sync-assets.mjs   # only the web bundle into app/src/main/assets/www
```

`app/src/main/assets/www` is generated and not committed. The APK lands in
`app/build/outputs/apk/<variant>/`. The version is in
`version.properties` (`versionName`, `versionCode`): raise both for every
release. The web app itself is gated for the LG TV (Chrome 53) by its
build; the Android WebView is far newer, so nothing is gated here.

## Signing and releases

`.github/workflows/tiagotv-androidtv.yml` (Actions → "TiagoTV Android TV"
→ Run workflow, or a `tiagotv-androidtv-v*` tag) builds the bundle, runs
the unit tests, builds the release APK and publishes
`TiagoTV-androidtv-<version>.apk` as a GitHub pre-release. It signs with
the keystore in four repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROIDTV_KEYSTORE_BASE64` | the `.jks` keystore, base64 |
| `ANDROIDTV_KEYSTORE_PASSWORD` | its store password |
| `ANDROIDTV_KEY_ALIAS` | the key alias |
| `ANDROIDTV_KEY_PASSWORD` | the key password |

Without them the APK is signed with the debug key and the release notes
say so (an update signed with another key will not install over it).
Locally, `app/build.gradle.kts` reads `TIAGOTV_KEYSTORE_FILE`,
`TIAGOTV_KEYSTORE_PASSWORD`, `TIAGOTV_KEY_ALIAS` and `TIAGOTV_KEY_PASSWORD`
from the environment. Never commit a keystore or a password.

## Not proven here

The emulator needs KVM, which the build machines lack, so these wait for
the projector itself: the WebView actually transparent over the
`SurfaceView` (if the picture does not show, switch `app:surface_type` to
`texture_view` in `activity_main.xml`), the TV launcher's banner, the IME on
the setup fields, and the device's codecs for the providers' MKV audio
(AC-3, E-AC-3, DTS come from the device's decoders; Media3 ships none).
