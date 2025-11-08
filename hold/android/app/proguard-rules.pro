# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-bare-kit
-keep class to.holepunch.bare.kit.react.** { *; }
-keep class to.holepunch.bare.kit.react.NativeBareKitSpec { *; }
-keep class to.holepunch.bare.kit.react.BareKitPackage { *; }
-keepclassmembers class to.holepunch.bare.kit.react.** { *; }

# Keep JNI methods for BareKit
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep all TurboModules
-keep class com.facebook.react.turbomodule.core.** { *; }
-keep interface com.facebook.react.turbomodule.core.interfaces.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# Add any project specific keep options here:
