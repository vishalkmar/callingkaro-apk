package com.callingkaro.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.twiliovoicereactnative.VoiceApplicationProxy

class MainApplication : Application(), ReactApplication {

  // Twilio Voice: binds the call foreground service (ongoing-call notification) + audio routing.
  private val voiceApplicationProxy by lazy { VoiceApplicationProxy(this) }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    voiceApplicationProxy.onCreate()
    loadReactNative(this)
  }

  override fun onTerminate() {
    voiceApplicationProxy.onTerminate()
    super.onTerminate()
  }
}
