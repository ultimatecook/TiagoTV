import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/** apps/androidtv/version.properties: versionName and versionCode. */
val versionFile = Properties().apply {
    rootProject.file("version.properties").inputStream().use { load(it) }
}

/**
 * Release signing from the environment (the workflow decodes the keystore
 * secret into TIAGOTV_KEYSTORE_FILE). Without it the release APK is signed
 * with the debug key, so it still installs; the workflow says so loudly.
 */
val keystoreFile = System.getenv("TIAGOTV_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }?.let { file(it) }
val hasReleaseKeystore = keystoreFile?.exists() == true

android {
    namespace = "com.tiagotv.androidtv"
    // Media3 1.5 compiles against API 35; the app still targets 34.
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tiagotv.androidtv"
        minSdk = 28
        targetSdk = 34
        versionName = versionFile.getProperty("versionName")
        versionCode = versionFile.getProperty("versionCode").toInt()
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("TIAGOTV_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TIAGOTV_KEY_ALIAS")
                keyPassword = System.getenv("TIAGOTV_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (hasReleaseKeystore) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        // Media3's unstable-API opt-ins are annotated where used; lint still
        // flags them in Kotlin property accessors. The warnings are reported,
        // never fatal for a personal build.
        disable += setOf("UnsafeOptInUsageError")
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    val media3 = "1.5.1"
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    testImplementation("junit:junit:4.13.2")
}
