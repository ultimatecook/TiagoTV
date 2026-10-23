// TiagoTV for Android TV: one application module (app/). The web bundle it
// shows comes from apps/webos-lite (tools/sync-assets.mjs copies it into
// app/src/main/assets/www before a build).
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "tiagotv-androidtv"
include(":app")
