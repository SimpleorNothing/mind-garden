plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.simpleornothing.mindgarden"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.simpleornothing.mindgarden.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0"
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
