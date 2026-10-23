package com.tiagotv.androidtv

import android.view.KeyEvent

/**
 * The remote's keys the WebView does not hand to the page as DOM key
 * events (Back, the channel and media keys, Info), mapped to the key codes
 * the LG remote sends and the page already understands
 * (apps/webos-lite/src/core/keys.ts). D-pad, OK, the digits and Page
 * Up/Down reach the page on their own and are left alone (null).
 */
object RemoteKeys {
    const val LITE_BACK = 461
    const val LITE_CHANNEL_UP = 33
    const val LITE_CHANNEL_DOWN = 34

    private val MAPPED: Map<Int, Int> = mapOf(
        KeyEvent.KEYCODE_BACK to LITE_BACK,
        KeyEvent.KEYCODE_ESCAPE to LITE_BACK,
        KeyEvent.KEYCODE_CHANNEL_UP to LITE_CHANNEL_UP,
        KeyEvent.KEYCODE_CHANNEL_DOWN to LITE_CHANNEL_DOWN,
        // Remotes without channel keys: next/previous zap too.
        KeyEvent.KEYCODE_MEDIA_NEXT to LITE_CHANNEL_UP,
        KeyEvent.KEYCODE_MEDIA_PREVIOUS to LITE_CHANNEL_DOWN,
        KeyEvent.KEYCODE_MEDIA_PLAY to 415,
        KeyEvent.KEYCODE_MEDIA_PAUSE to 19,
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE to 179,
        KeyEvent.KEYCODE_MEDIA_STOP to 413,
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD to 417,
        KeyEvent.KEYCODE_MEDIA_REWIND to 412,
        KeyEvent.KEYCODE_INFO to 457,
    )

    /** The page's key code for an Android key code, or null to let the WebView deliver it. */
    fun liteKeyCode(androidKeyCode: Int): Int? = MAPPED[androidKeyCode]

    fun isBack(androidKeyCode: Int): Boolean = MAPPED[androidKeyCode] == LITE_BACK

    /** The script that hands the key to the page; it evaluates to true when the page took it. */
    fun script(liteKeyCode: Int): String =
        "window.__tiagotvNativeKey?window.__tiagotvNativeKey($liteKeyCode):false"
}
