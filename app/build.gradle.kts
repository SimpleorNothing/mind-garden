plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.simpleornothing.mindgarden"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.simpleornothing.mindgarden.app.v04"
        minSdk = 26
        targetSdk = 35
        versionCode = 9
        versionName = "0.4.5"
        manifestPlaceholders["appLabel"] = "Mind Garden 0.4"
    }
    signingConfigs.getByName("debug") {
        storeFile = file(System.getenv("HOME") + "/.android/debug.keystore")
    }
    buildTypes {
        create("live") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".live"
            versionNameSuffix = "-live"
            manifestPlaceholders["appLabel"] = "Mind Garden LIVE"
            matchingFallbacks += listOf("debug")
        }
    }
    buildTypes.create("local") {
        initWith(buildTypes.getByName("live"))
        applicationIdSuffix = ".local"
        versionNameSuffix = "-local"
        isDebuggable = false
        manifestPlaceholders["appLabel"] = "Mind Garden"
        matchingFallbacks += listOf("live", "debug")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
dependencies { implementation("androidx.appcompat:appcompat:1.7.0"); implementation("androidx.activity:activity-ktx:1.9.3") }
