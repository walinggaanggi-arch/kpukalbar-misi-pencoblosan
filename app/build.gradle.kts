plugins {
    id("com.android.application")
}

android {
    // Ganti dengan nama paket milik instansi Anda sebelum rilis ke Play Store.
    namespace = "id.misipencoblosan.game"
    compileSdk = 36

    defaultConfig {
        applicationId = "id.misipencoblosan.game"
        minSdk = 24          // Android 7.0 ke atas
        targetSdk = 36       // Syarat Google Play sejak 31 Agustus 2026
        versionCode = 1      // Naikkan setiap merilis versi baru
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
