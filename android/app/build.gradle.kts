plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.chaquo.python")
}

val buildNo = (System.getenv("BUILD_NUMBER") ?: "1").toInt()

android {
    namespace = "de.balumail.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "de.balumail.app"
        minSdk = 29
        targetSdk = 36
        versionCode = buildNo
        versionName = "1.0.$buildNo"
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
    }

    buildFeatures { buildConfig = true }

    signingConfigs {
        create("play") {
            // Upload-Schlüssel für Google Play (liegt nur als GitHub-Secret vor); lokal ersatzweise der Testschlüssel
            val ks = System.getenv("PLAY_KEYSTORE")
            if (ks != null && File(ks).isFile) {
                storeFile = File(ks)
                storePassword = System.getenv("PLAY_KEYSTORE_PW")
                keyAlias = "balumail-upload"
                keyPassword = System.getenv("PLAY_KEYSTORE_PW")
            } else {
                storeFile = file("sideload.keystore"); storePassword = "android"; keyAlias = "androiddebugkey"; keyPassword = "android"
            }
        }
        create("sideload") {
            // Fester Schlüssel, damit Updates über die vorhandene App installiert werden können
            storeFile = file("sideload.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    flavorDimensions += "vertrieb"
    productFlavors {
        // APK zum direkten Installieren (mit eigenen Updates über GitHub)
        create("sideload") { dimension = "vertrieb"; signingConfig = signingConfigs.getByName("sideload") }
        // App Bundle für den Google Play Store (Updates nur über Play)
        create("play") { dimension = "vertrieb"; signingConfig = signingConfigs.getByName("play") }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

chaquopy {
    defaultConfig {
        version = "3.12"
        pip { install("certifi") }
        extractPackages("balu")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
