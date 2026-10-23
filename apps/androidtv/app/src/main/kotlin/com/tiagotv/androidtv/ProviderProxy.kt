package com.tiagotv.androidtv

import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The page lives at https://appassets.androidplatform.net (WebViewAssetLoader),
 * so its XMLHttpRequests to the provider are cross-origin and the WebView
 * would enforce CORS, which Xtream panels do not speak. Every other
 * http(s) GET the page makes is fetched here instead (shouldInterceptRequest),
 * on the WebView's own worker thread, and handed back with
 * `Access-Control-Allow-Origin: *`, so the page reaches the panel as the
 * LG app does from file://. Nothing is cached or logged: the URLs carry
 * the account's credentials.
 *
 * Only GET and HEAD are proxied (the page sends nothing else); a request
 * that cannot be made returns null and the WebView tries it itself.
 */
class ProviderProxy(private val defaultUserAgent: String) {
    fun intercept(request: WebResourceRequest): WebResourceResponse? {
        val url = request.url
        val scheme = url.scheme ?: return null
        if (scheme != "http" && scheme != "https") {
            return null
        }
        if (url.host.equals(ASSET_HOST, ignoreCase = true)) {
            return null
        }
        if (request.method != "GET" && request.method != "HEAD") {
            return null
        }
        return try {
            fetch(url.toString(), request.method, request.requestHeaders, 0)
        } catch (error: IOException) {
            null
        } catch (error: RuntimeException) {
            null
        }
    }

    private fun fetch(url: String, method: String, headers: Map<String, String>, redirects: Int): WebResourceResponse {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.instanceFollowRedirects = false
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.useCaches = false
        var userAgent = defaultUserAgent
        for ((name, value) in headers) {
            when {
                name.equals("User-Agent", ignoreCase = true) -> userAgent = value
                DROPPED_REQUEST_HEADERS.any { it.equals(name, ignoreCase = true) } -> Unit
                name.startsWith("sec-", ignoreCase = true) -> Unit
                else -> connection.setRequestProperty(name, value)
            }
        }
        connection.setRequestProperty("User-Agent", userAgent)
        val status = connection.responseCode
        if (status in 300..399 && redirects < MAX_REDIRECTS) {
            val location = connection.getHeaderField("Location")
            connection.disconnect()
            if (location != null) {
                return fetch(URL(URL(url), location).toString(), method, headers, redirects + 1)
            }
        }
        val body = if (status >= 400) connection.errorStream ?: ByteArrayInputStream(ByteArray(0)) else connection.inputStream
        val (mime, charset) = splitContentType(connection.contentType)
        val responseHeaders = LinkedHashMap<String, String>()
        responseHeaders["Access-Control-Allow-Origin"] = "*"
        for (name in FORWARDED_RESPONSE_HEADERS) {
            connection.getHeaderField(name)?.let { responseHeaders[name] = it }
        }
        val reason = connection.responseMessage?.takeIf { it.isNotBlank() } ?: if (status >= 400) "Error" else "OK"
        return WebResourceResponse(mime, charset, status, reason, responseHeaders, body)
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        private const val CONNECT_TIMEOUT_MS = 20_000
        /** Past the page's longest request timeout (a platform's list: 90 s). */
        private const val READ_TIMEOUT_MS = 100_000
        private const val MAX_REDIRECTS = 5
        private val DROPPED_REQUEST_HEADERS = listOf(
            "Host", "Connection", "Accept-Encoding", "X-Requested-With", "Origin", "Referer", "Content-Length",
        )
        private val FORWARDED_RESPONSE_HEADERS = listOf(
            "Cache-Control", "ETag", "Last-Modified", "Expires", "Content-Disposition", "Accept-Ranges", "Content-Range",
        )

        /** "application/json; charset=utf-8" → ("application/json", "utf-8"); text gets UTF-8 by default. */
        fun splitContentType(contentType: String?): Pair<String, String?> {
            val raw = contentType?.trim().orEmpty()
            val parts = raw.split(';')
            val mime = parts.firstOrNull()?.trim()?.takeIf { it.isNotEmpty() } ?: "application/octet-stream"
            val charset = parts.drop(1)
                .map { it.trim() }
                .firstOrNull { it.startsWith("charset=", ignoreCase = true) }
                ?.substringAfter('=')
                ?.trim('"', ' ')
            val textual = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("xml") || mime.endsWith("javascript")
            return mime to (charset ?: if (textual) "utf-8" else null)
        }
    }
}
