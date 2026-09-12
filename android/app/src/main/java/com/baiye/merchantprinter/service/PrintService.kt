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
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.WebSocket

class PrintService : Service() {
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private lateinit var store: LocalStore
    private lateinit var api: MerchantApi
    @Volatile private var syncing = false
    @Volatile private var realtimeConnected = false
    private val reconnectScheduled = AtomicBoolean(false)
    private var webSocket: WebSocket? = null

    override fun onCreate() {
        super.onCreate(); store = LocalStore(this); api = MerchantApi(store); createChannel(); startForeground(NOTIFICATION_ID, notification("正在連線訂單事件…"))
        connectRealtime()
        executor.scheduleWithFixedDelay(::safeSync, 0, 30, TimeUnit.SECONDS)
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_MANUAL_PRINT) intent.getStringExtra(EXTRA_JOB_ID)?.let { jobId -> executor.execute { manualPrint(jobId) } }
        return START_STICKY
    }
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { webSocket?.cancel(); executor.shutdownNow(); super.onDestroy() }

    private fun connectRealtime() {
        if (!store.hasSession()) return
        webSocket?.cancel()
        webSocket = api.connectOrderEvents(
            onEvent = { event -> executor.execute { consumeOrderEvent(event) } },
            onState = { connected ->
                realtimeConnected = connected
                updateNotification(if (connected) "訂單即時連線" else "訂單離線，等待重連")
                if (!connected && reconnectScheduled.compareAndSet(false, true)) {
                    executor.schedule({ reconnectScheduled.set(false); connectRealtime() }, 5, TimeUnit.SECONDS)
                }
            },
        )
    }

    private fun consumeOrderEvent(event: OrderEvent) {
        if (event.sequence > store.lastEventSequence()) store.setLastEventSequence(event.sequence)
        if (event.eventType == "order_created") notifyNewOrder(event)
        sendBroadcast(Intent(ACTION_ORDER_EVENT).setPackage(packageName).putExtra("event_id", event.eventId))
    }

    private fun safeSync() {
        if (syncing || !store.hasSession()) return
        syncing = true
        try {
            api.syncPending()
            api.orderEvents(store.lastEventSequence()).forEach(::consumeOrderEvent)
            val localPrinter = store.printer()
            runCatching { api.registerDevice(localPrinter?.id.orEmpty()) }
            if (localPrinter == null) {
                updateNotification(if (realtimeConnected) "訂單即時連線 • 未設定印表機" else "訂單離線，等待重連")
                store.setLastSync(System.currentTimeMillis())
                return
            }
            // The backend setting is authoritative. A stale local ON value must never
            // overwrite a remotely disabled printer or claim a new pending job.
            val printer = api.printers().firstOrNull { it.id == localPrinter.id } ?: return
            store.savePrinter(printer)
            updateNotification("${if (realtimeConnected) "即時連線" else "離線補單"} • ${printer.name} • ${if (printer.autoPrint) "自動出單 ON" else "自動出單 OFF"}")
            if (!printer.canAutoClaim) {
                store.setLastSync(System.currentTimeMillis())
                return
            }
            recover(printer)
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

    private fun notifyNewOrder(event: OrderEvent) {
        if (!store.markNotified(event.orderCode)) return
        val table = event.table.ifBlank { "外帶" }
        val intent = PendingIntent.getActivity(this, event.orderCode.hashCode(), Intent(this, MainActivity::class.java).putExtra("order_code", event.orderCode), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val message = "$table 新訂單｜${event.itemCount} 項商品"
        val notification = NotificationCompat.Builder(this, ORDER_CHANNEL_ID).setSmallIcon(android.R.drawable.stat_notify_more).setContentTitle("點餐靈・新訂單").setContentText(message).setAutoCancel(true).setContentIntent(intent).setPriority(NotificationCompat.PRIORITY_HIGH).setDefaults(NotificationCompat.DEFAULT_ALL).build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(event.orderCode.hashCode(), notification)
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

    private fun manualPrint(jobId: String) {
        try {
            val localPrinter = store.printer() ?: return
            val printer = api.printers().firstOrNull { it.id == localPrinter.id && it.enabled } ?: return
            val pending = api.manualPendingJobs().firstOrNull { it.id == jobId } ?: return
            val requestId = "manual-${java.util.UUID.randomUUID()}"
            store.saveJob(pending.copy(claimRequestId = requestId))
            val claimed = api.claim(jobId, requestId, manual = true)
            store.saveJob(claimed)
            process(claimed, printer)
        } catch (_: Exception) { }
    }

    private fun createChannel() { (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).apply { createNotificationChannel(NotificationChannel(CHANNEL_ID, "點餐靈營運服務", NotificationManager.IMPORTANCE_LOW)); createNotificationChannel(NotificationChannel(ORDER_CHANNEL_ID, "點餐靈新訂單", NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true) }) } }
    private fun notification(text: String): Notification {
        val intent = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this, CHANNEL_ID).setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("點餐靈營運服務運作中").setContentText("${store.merchantName().ifBlank { "商家" }} • $text").setOngoing(true).setContentIntent(intent).build()
    }
    private fun updateNotification(text: String) { (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification(text)) }

    companion object {
        private const val CHANNEL_ID = "baiye_print_service_v1"; private const val ORDER_CHANNEL_ID = "baiye_new_orders_v1"; private const val NOTIFICATION_ID = 1602
        private const val ACTION_MANUAL_PRINT = "com.baiye.merchantprinter.MANUAL_PRINT"
        const val ACTION_ORDER_EVENT = "com.baiye.merchantprinter.ORDER_EVENT"
        private const val EXTRA_JOB_ID = "print_job_id"
        fun start(context: Context) { context.startForegroundService(Intent(context, PrintService::class.java)) }
        fun manualPrint(context: Context, jobId: String) { context.startForegroundService(Intent(context, PrintService::class.java).setAction(ACTION_MANUAL_PRINT).putExtra(EXTRA_JOB_ID, jobId)) }
    }
}
