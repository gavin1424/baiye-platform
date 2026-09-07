package com.baiye.merchantprinter.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.baiye.merchantprinter.MainActivity
import com.baiye.merchantprinter.data.*
import com.baiye.merchantprinter.network.MerchantApi
import com.baiye.merchantprinter.printer.EscPosRenderer
import com.baiye.merchantprinter.printer.LanEscPosPrinter
import com.baiye.merchantprinter.printer.PrinterIoException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class PrintService : Service() {
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private lateinit var store: LocalStore
    private lateinit var api: MerchantApi
    @Volatile private var syncing = false

    override fun onCreate() {
        super.onCreate(); store = LocalStore(this); api = MerchantApi(store); createChannel(); startForeground(NOTIFICATION_ID, notification("正在連線列印佇列…"))
        executor.scheduleWithFixedDelay(::safeSync, 0, 3, TimeUnit.SECONDS)
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }

    private fun safeSync() {
        if (syncing || !store.hasSession()) return
        syncing = true
        try {
            val printer = store.printer() ?: return
            updateNotification("${printer.name} • ${if (printer.autoPrint) "自動出單 ON" else "自動出單 OFF"}")
            recover(printer)
            if (!printer.autoPrint || !printer.enabled) return
            api.pendingJobs().forEach { discovered ->
                if (store.jobsIn(LocalJobState.PRINTED_ACKED, LocalJobState.AMBIGUOUS).none { it.id == discovered.id }) {
                    val requestId = "claim-${java.util.UUID.randomUUID()}"
                    store.saveJob(discovered.copy(claimRequestId = requestId))
                    val claimed = api.claim(discovered.id, requestId)
                    store.saveJob(claimed) // claim token is durable before any physical side effect
                    process(claimed, printer)
                }
            }
            store.setLastSync(System.currentTimeMillis())
        } catch (_: Exception) { /* transient backend failures are retried by the next bounded poll */ }
        finally { syncing = false }
    }

    private fun recover(printer: PrinterConfig) {
        store.jobsIn("DISCOVERED").filter { it.claimRequestId.isNotBlank() }.forEach { discovered ->
            try { val claimed = api.claim(discovered.id, discovered.claimRequestId); store.saveJob(claimed); process(claimed, printer) } catch (_: Exception) { }
        }
        // A completed write is never printed again; only its backend ACK is retried.
        store.jobsIn(LocalJobState.WRITE_COMPLETED_AWAITING_ACK).forEach { job ->
            try { api.printed(job, 0); store.updateJobState(job.id, LocalJobState.PRINTED_ACKED) } catch (_: Exception) { }
        }
        // Process death after printing intent is physically ambiguous. Escalate it,
        // do not auto-reprint, and require the merchant to inspect/reprint manually.
        store.jobsIn(LocalJobState.PRINTING_INTENT).forEach { job ->
            val failure = IllegalStateException("應用在列印中斷，可能已列印，請人工確認")
            try { api.failed(job, true, failure) } catch (_: Exception) { }
            store.updateJobState(job.id, LocalJobState.AMBIGUOUS, failure.message.orEmpty())
        }
        store.jobsIn(LocalJobState.CLAIMED_DURABLE).forEach { process(it, printer) }
    }

    private fun process(job: PrintJob, printer: PrinterConfig) {
        var physicalIntent = false
        var bytesWritten = 0
        try {
            api.printing(job)
            store.updateJobState(job.id, LocalJobState.PRINTING_INTENT)
            physicalIntent = true
            val bytes = EscPosRenderer().kitchen(job.payloadJson)
            repeat(job.copies.coerceIn(1, 5)) { bytesWritten += LanEscPosPrinter().print(printer, bytes) }
            store.updateJobState(job.id, LocalJobState.WRITE_COMPLETED_AWAITING_ACK)
            try { api.printed(job, bytesWritten); store.updateJobState(job.id, LocalJobState.PRINTED_ACKED) } catch (_: Exception) { /* ACK-only recovery; never reprint */ }
        } catch (error: Exception) {
            val ambiguous = ((error as? PrinterIoException)?.ambiguous ?: physicalIntent) || bytesWritten > 0
            try { api.failed(job, ambiguous, error) } catch (_: Exception) { }
            store.updateJobState(job.id, if (ambiguous) LocalJobState.AMBIGUOUS else LocalJobState.SAFE_FAILURE, error.message.orEmpty())
        }
    }

    private fun createChannel() { (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(NotificationChannel(CHANNEL_ID, "創百業出單服務", NotificationManager.IMPORTANCE_LOW)) }
    private fun notification(text: String): Notification {
        val intent = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("創百業出單服務運作中").setContentText("${store.merchantName().ifBlank { "百工牛肉麵" }} • $text").setOngoing(true).setContentIntent(intent).build()
    }
    private fun updateNotification(text: String) { (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification(text)) }

    companion object {
        private const val CHANNEL_ID = "baiye_print_service_v1"; private const val NOTIFICATION_ID = 1602
        fun start(context: Context) { context.startForegroundService(Intent(context, PrintService::class.java)) }
    }
}
