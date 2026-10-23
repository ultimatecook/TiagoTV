package com.tiagotv.androidtv

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import androidx.media3.ui.SubtitleView
import androidx.webkit.WebViewAssetLoader

/**
 * TiagoTV for Android TV: the web app from apps/webos-lite (assets/www)
 * in a transparent WebView over the native player (PlayerView). The
 * page draws everything (the Home, the OSD, the menus) and plays through
 * window.TiagoTVNative (NativeBridge → PlayerHost); the provider's
 * requests go through ProviderProxy. See apps/androidtv/README.md.
 *
 * Keys: the D-pad, OK and the digits reach the page as DOM key events on
 * their own; Back, CH+/CH-, the media keys and Info are handed to it with
 * the LG remote's codes (RemoteKeys). The app closes only when the page
 * says it did not take Back, or asks to (its own exit dialog).
 */
@OptIn(UnstableApi::class)
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var playerView: PlayerView
    private lateinit var playerHost: PlayerHost

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        playerView = findViewById(R.id.player)
        webView = findViewById(R.id.web)
        val userAgent = "${WebSettings.getDefaultUserAgent(this)} TiagoTV/${BuildConfig.VERSION_NAME}"
        playerHost = PlayerHost(this, playerView, userAgent, ::sendEvent, ::keepScreenOn)
        styleSubtitles()
        setUpWebView(userAgent)
        hideSystemBars()
        webView.loadUrl(START_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView(userAgent: String) {
        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val proxy = ProviderProxy(userAgent)
        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // The page is https (appassets), the providers are http.
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // The page lays itself out at 1920x1080 (its viewport meta).
            useWideViewPort = true
            loadWithOverviewMode = true
            textZoom = 100
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgent
        }
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.addJavascriptInterface(NativeBridge(playerHost) { finish() }, BRIDGE_NAME)
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url) ?: proxy.intercept(request)

            /** The page never navigates; a link that would leave it is dropped. */
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                !request.url.host.equals(ProviderProxy.ASSET_HOST, ignoreCase = true)
        }
        webView.requestFocus()
    }

    /** The native subtitles, as the page draws its own: white on a dark band, large. */
    private fun styleSubtitles() {
        playerView.subtitleView?.apply {
            setApplyEmbeddedStyles(false)
            setApplyEmbeddedFontSizes(false)
            setStyle(
                CaptionStyleCompat(
                    Color.WHITE,
                    Color.argb(184, 0, 0, 0),
                    Color.TRANSPARENT,
                    CaptionStyleCompat.EDGE_TYPE_NONE,
                    Color.TRANSPARENT,
                    null,
                ),
            )
            setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * 1.15f)
            setBottomPaddingFraction(0.08f)
        }
    }

    private fun hideSystemBars() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
    }

    private fun sendEvent(json: String) {
        if (!isDestroyed) {
            webView.evaluateJavascript(BridgeEvents.call(json), null)
        }
    }

    private fun keepScreenOn(on: Boolean) {
        if (on) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val code = RemoteKeys.liteKeyCode(event.keyCode) ?: return super.dispatchKeyEvent(event)
        if (event.action == KeyEvent.ACTION_DOWN) {
            val back = RemoteKeys.isBack(event.keyCode)
            webView.evaluateJavascript(RemoteKeys.script(code)) { result ->
                if (back && result != "true" && !isFinishing) {
                    finish()
                }
            }
        }
        return true
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    /** In the background (the TV's Home): the stream must not keep the account's connection. */
    override fun onStop() {
        playerHost.stop()
        super.onStop()
    }

    override fun onDestroy() {
        playerHost.release()
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val BRIDGE_NAME = "TiagoTVNative"
        private const val START_URL = "https://${ProviderProxy.ASSET_HOST}/assets/www/index.html"
    }
}
