package com.tiagotv.androidtv

/** A track as the page lists it (native-bridge.ts, NativeTrackInfo). */
data class TrackInfo(
    val id: String,
    val language: String?,
    val label: String?,
    val selected: Boolean,
    val forced: Boolean,
)

/**
 * The events the native player sends the page, as JavaScript object
 * literals for `window.__tiagotvNativeEvent`
 * (apps/webos-lite/src/player/native-bridge.ts). Built by hand: org.json
 * is not there for the unit tests, and the literal must stay a valid
 * JavaScript expression (U+2028 and U+2029 are escaped). Nothing here
 * ever carries a URL.
 */
object BridgeEvents {
    fun simple(type: String): String = "{\"type\":${quote(type)}}"

    fun ready(durationSeconds: Double?): String =
        "{\"type\":\"ready\",\"duration\":${number(durationSeconds)}}"

    /** `timeupdate` and `seeked`: where the stream is. */
    fun time(type: String, currentSeconds: Double, durationSeconds: Double?): String =
        "{\"type\":${quote(type)},\"currentTime\":${number(currentSeconds)},\"duration\":${number(durationSeconds)}}"

    /** A failed stream: the HTTP status it was refused with, when known. */
    fun error(status: Int?, code: String): String =
        "{\"type\":\"error\",\"status\":${status?.toString() ?: "null"},\"code\":${quote(code)}}"

    fun tracks(audio: List<TrackInfo>, text: List<TrackInfo>): String =
        "{\"type\":\"tracks\",\"audio\":${list(audio)},\"text\":${list(text)}}"

    /** The statement that delivers `json` to the page. */
    fun call(json: String): String = "window.__tiagotvNativeEvent&&window.__tiagotvNativeEvent($json);"

    private fun list(tracks: List<TrackInfo>): String =
        tracks.joinToString(",", "[", "]") { track ->
            "{\"id\":${quote(track.id)},\"language\":${quoteOrNull(track.language)}," +
                "\"label\":${quoteOrNull(track.label)},\"selected\":${track.selected},\"forced\":${track.forced}}"
        }

    private fun number(value: Double?): String =
        if (value == null || value.isNaN() || value.isInfinite()) "null" else value.toString()

    private fun quoteOrNull(text: String?): String = if (text == null) "null" else quote(text)

    fun quote(text: String): String {
        val out = StringBuilder(text.length + 2).append('"')
        for (char in text) {
            when {
                char == '"' -> out.append("\\\"")
                char == '\\' -> out.append("\\\\")
                char == '\n' -> out.append("\\n")
                char == '\r' -> out.append("\\r")
                char == '\t' -> out.append("\\t")
                char < ' ' || char == ' ' || char == ' ' ->
                    out.append("\\u").append(String.format("%04x", char.code))
                else -> out.append(char)
            }
        }
        return out.append('"').toString()
    }
}
