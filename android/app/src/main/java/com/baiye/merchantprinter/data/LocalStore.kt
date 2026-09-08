package com.baiye.merchantprinter.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

class LocalStore(context: Context) : SQLiteOpenHelper(context.applicationContext, "baiye_printer_v1.db", null, 2) {
    val applicationContext: Context = context.applicationContext
    private val preferences = context.getSharedPreferences("baiye_session_v1", Context.MODE_PRIVATE)

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE printer_config(id TEXT PRIMARY KEY,name TEXT NOT NULL,model TEXT NOT NULL,host TEXT NOT NULL,port INTEGER NOT NULL,paper_width_mm INTEGER NOT NULL,enabled INTEGER NOT NULL,auto_print INTEGER NOT NULL,copies INTEGER NOT NULL,updated_at INTEGER NOT NULL)""")
        db.execSQL("""CREATE TABLE local_print_jobs(id TEXT PRIMARY KEY,order_code TEXT NOT NULL,printer_id TEXT NOT NULL,status TEXT NOT NULL,copies INTEGER NOT NULL,attempt_count INTEGER NOT NULL,payload_json TEXT NOT NULL,claim_token TEXT NOT NULL,local_state TEXT NOT NULL,delivery_outcome TEXT NOT NULL,last_error TEXT NOT NULL,updated_at INTEGER NOT NULL,claim_request_id TEXT NOT NULL)""")
        db.execSQL("""CREATE TABLE local_print_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL,state TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL)""")
        db.execSQL("CREATE INDEX idx_local_jobs_state ON local_print_jobs(local_state,updated_at)")
        createOperationsTables(db)
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { if (oldVersion < 2) createOperationsTables(db) }

    private fun createOperationsTables(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS app_cache(cache_key TEXT PRIMARY KEY,payload_json TEXT NOT NULL,updated_at INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS pending_mutations(id TEXT PRIMARY KEY,method TEXT NOT NULL,path TEXT NOT NULL,body_json TEXT NOT NULL,idempotency_key TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',last_error TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS notified_orders(order_code TEXT PRIMARY KEY,notified_at INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_pending_mutations ON pending_mutations(state,created_at)")
    }

    fun deviceId(): String {
        var value = preferences.getString("device_id", null)
        if (value == null) { value = "android_${UUID.randomUUID()}"; preferences.edit().putString("device_id", value).apply() }
        return value
    }
    fun saveSession(cookie: String, csrf: String, merchantId: String, merchantName: String) = preferences.edit().putString("cookie", cookie).putString("csrf", csrf).putString("merchant_id", merchantId).putString("merchant_name", merchantName).apply()
    fun cookie() = preferences.getString("cookie", "") ?: ""
    fun csrf() = preferences.getString("csrf", "") ?: ""
    fun merchantId() = preferences.getString("merchant_id", "") ?: ""
    fun merchantName() = preferences.getString("merchant_name", "") ?: ""
    fun hasSession() = preferences.getString("merchant_id", "").orEmpty().isNotBlank()
    fun clearSession() = preferences.edit().remove("cookie").remove("csrf").remove("merchant_id").remove("merchant_name").apply()
    fun setLastSync(epochMs: Long) = preferences.edit().putLong("last_sync", epochMs).apply()
    fun lastSync() = preferences.getLong("last_sync", 0)
    private fun scopedCacheKey(key: String) = "${merchantId()}:$key"
    fun cache(key: String, json: String) = writableDatabase.insertWithOnConflict("app_cache", null, ContentValues().apply { put("cache_key", scopedCacheKey(key)); put("payload_json", json); put("updated_at", System.currentTimeMillis()) }, SQLiteDatabase.CONFLICT_REPLACE)
    fun cached(key: String): String? = readableDatabase.rawQuery("SELECT payload_json FROM app_cache WHERE cache_key=?", arrayOf(scopedCacheKey(key))).use { if (it.moveToFirst()) it.getString(0) else null }
    fun onboardingDone() = preferences.getBoolean("onboarding_done", false)
    fun setOnboardingDone(done: Boolean = true) = preferences.edit().putBoolean("onboarding_done", done).apply()
    fun demoMode() = preferences.getBoolean("qa_demo_authorized", false) && preferences.getBoolean("demo_mode", false)
    fun setDemoModeForQa(enabled: Boolean) = preferences.edit().putBoolean("qa_demo_authorized", enabled).putBoolean("demo_mode", enabled).apply()
    fun exitDemoModeAfterMerchantAuth() = preferences.edit().putBoolean("qa_demo_authorized", false).putBoolean("demo_mode", false).apply()

    data class PendingMutation(val id: String, val method: String, val path: String, val body: String, val key: String)
    fun enqueueMutation(method: String, path: String, body: String, key: String): String {
        val id = key.ifBlank { UUID.randomUUID().toString() }
        writableDatabase.insertWithOnConflict("pending_mutations", null, ContentValues().apply { put("id", id); put("method", method); put("path", path); put("body_json", body); put("idempotency_key", key); put("state", "pending"); put("created_at", System.currentTimeMillis()); put("updated_at", System.currentTimeMillis()) }, SQLiteDatabase.CONFLICT_IGNORE)
        return id
    }
    fun pendingMutations(): List<PendingMutation> = readableDatabase.rawQuery("SELECT id,method,path,body_json,idempotency_key FROM pending_mutations WHERE state='pending' ORDER BY created_at", null).use { cursor -> buildList { while(cursor.moveToNext()) add(PendingMutation(cursor.getString(0),cursor.getString(1),cursor.getString(2),cursor.getString(3),cursor.getString(4))) } }
    fun mutationSynced(id: String) = writableDatabase.delete("pending_mutations", "id=?", arrayOf(id))
    fun mutationFailed(id: String, error: String) = writableDatabase.update("pending_mutations", ContentValues().apply { put("last_error", error.take(300)); put("updated_at", System.currentTimeMillis()) }, "id=?", arrayOf(id))
    fun pendingCount(): Int = readableDatabase.rawQuery("SELECT COUNT(*) FROM pending_mutations WHERE state='pending'", null).use { it.moveToFirst(); it.getInt(0) }
    fun markNotified(orderCode: String): Boolean = writableDatabase.insertWithOnConflict("notified_orders", null, ContentValues().apply { put("order_code",orderCode); put("notified_at",System.currentTimeMillis()) }, SQLiteDatabase.CONFLICT_IGNORE) != -1L

    fun savePrinter(config: PrinterConfig) {
        writableDatabase.insertWithOnConflict("printer_config", null, ContentValues().apply {
            put("id", config.id.ifBlank { "local-primary" }); put("name", config.name); put("model", config.model)
            put("host", config.host); put("port", config.port); put("paper_width_mm", config.paperWidthMm)
            put("enabled", if (config.enabled) 1 else 0); put("auto_print", if (config.autoPrint) 1 else 0); put("copies", config.copies); put("updated_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }
    fun printer(): PrinterConfig? = readableDatabase.rawQuery("SELECT * FROM printer_config ORDER BY updated_at DESC LIMIT 1", null).use { c ->
        if (!c.moveToFirst()) null else PrinterConfig(c.getString(c.getColumnIndexOrThrow("id")), c.getString(c.getColumnIndexOrThrow("name")), c.getString(c.getColumnIndexOrThrow("model")), c.getString(c.getColumnIndexOrThrow("host")), c.getInt(c.getColumnIndexOrThrow("port")), c.getInt(c.getColumnIndexOrThrow("paper_width_mm")), c.getInt(c.getColumnIndexOrThrow("enabled")) == 1, c.getInt(c.getColumnIndexOrThrow("auto_print")) == 1, c.getInt(c.getColumnIndexOrThrow("copies")))
    }

    fun saveJob(job: PrintJob) {
        writableDatabase.insertWithOnConflict("local_print_jobs", null, ContentValues().apply {
            put("id", job.id); put("order_code", job.orderCode); put("printer_id", job.printerId); put("status", job.status); put("copies", job.copies)
            put("attempt_count", job.attemptCount); put("payload_json", job.payloadJson); put("claim_token", job.claimToken); put("local_state", job.localState)
            put("delivery_outcome", job.deliveryOutcome); put("last_error", job.lastError); put("updated_at", System.currentTimeMillis())
            put("claim_request_id", job.claimRequestId)
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }
    fun updateJobState(id: String, state: String, error: String = "") {
        writableDatabase.update("local_print_jobs", ContentValues().apply { put("local_state", state); put("last_error", error); put("updated_at", System.currentTimeMillis()) }, "id=?", arrayOf(id))
        writableDatabase.insert("local_print_attempts", null, ContentValues().apply { put("job_id", id); put("state", state); put("detail", error); put("created_at", System.currentTimeMillis()) })
    }
    fun jobsIn(vararg states: String): List<PrintJob> {
        if (states.isEmpty()) return emptyList()
        val marks = states.joinToString(",") { "?" }
        return readableDatabase.rawQuery("SELECT * FROM local_print_jobs WHERE local_state IN($marks) ORDER BY updated_at", states).use { c -> buildList {
            while (c.moveToNext()) add(PrintJob(c.getString(0), c.getString(1), c.getString(2), c.getString(3), c.getInt(4), c.getInt(5), c.getString(6), c.getString(7), c.getString(8), c.getString(9), c.getString(10), c.getString(12)))
        } }
    }
}
