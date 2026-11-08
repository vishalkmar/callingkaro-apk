# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- CallingKaro release rules (R8) ---
# Twilio Voice SDK (JNI / reflection)
-keep class com.twilio.** { *; }
-keep class tvo.webrtc.** { *; }
-dontwarn tvo.webrtc.**
# react-native-config BuildConfig lookup
-keep class com.callingkaro.app.BuildConfig { *; }
# Google Mobile Ads / Play Billing are shipped with consumer rules; keep annotations
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
# react-native-webrtc (Telnyx calls): WebRTC is reached from native code by class / method name (JNI),
# and its AAR references an optional AV1 decoder that is not shipped (Dav1dDecoder$Natives).
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
-keep class com.oney.WebRTCModule.** { *; }
