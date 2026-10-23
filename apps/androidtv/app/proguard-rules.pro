# The page calls these through window.TiagoTVNative (addJavascriptInterface).
-keepclassmembers class com.tiagotv.androidtv.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
