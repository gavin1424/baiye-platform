package com.baiye.merchantprinter.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.baiye.merchantprinter.data.LocalStore

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && LocalStore(context).hasSession())
            WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<RestorePrintServiceWorker>().build())
    }
}
class RestorePrintServiceWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = try { if (LocalStore(applicationContext).hasSession()) PrintService.start(applicationContext); Result.success() } catch (_: Exception) { Result.retry() }
}
