package com.baiye.merchantprinter

import android.app.Application
import androidx.work.Configuration

class BaiyeApplication : Application(), Configuration.Provider {
    override val workManagerConfiguration = Configuration.Builder().setMinimumLoggingLevel(android.util.Log.INFO).build()
}
