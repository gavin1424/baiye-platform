package com.baiye.merchantprinter.network

import com.baiye.merchantprinter.BuildConfig
import com.baiye.merchantprinter.data.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, val code: String, message: String) : Exception(message)
class MerchantSelectionRequired(val selectionToken: String, val merchants: List<Pair<String, String>>) : Exception("請選擇商家")

class MerchantApi(
    private val store: LocalStore,
    private val baseUrl: String = BuildConfig.API_BASE_URL,
    private val cookieJar: PersistentCookieJar = PersistentCookieJar(store.applicationContext),
) {
    data class Response(val status: Int, val body: JSONObject)

    private val client = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private fun request(path: String, method: String = "GET", body: JSONObject? = null, idempotencyKey: String = ""): Response {
        val requestBody = body?.toString()?.toRequestBody(JSON)
        val builder = Request.Builder().url(baseUrl.trimEnd('/') + path).header("Accept", "application/json")
        if (path.startsWith("/api/merchant-auth/") || path.startsWith("/api/merchant-admin/")) builder.header("Origin", BuildConfig.MERCHANT_AUTH_ORIGIN)
        if (method !in listOf("GET", "HEAD") && store.csrf().isNotBlank()) builder.header("X-CSRF-Token", store.csrf())
        if (idempotencyKey.isNotBlank()) builder.header("Idempotency-Key", idempotencyKey)
        builder.method(method, if (method in listOf("GET", "HEAD")) null else requestBody ?: EMPTY_JSON)

        try {
            client.newCall(builder.build()).execute().use { response ->
                val text = response.body?.string().orEmpty()
                val json = runCatching { JSONObject(text.ifBlank { "{}" }) }.getOrElse { JSONObject().put("error", text) }
                if (!response.isSuccessful) throw ApiException(response.code, json.optString("code"), friendlyError(response.code, json.optString("error")))
                return Response(response.code, json)
            }
        } catch (error: ApiException) { throw error }
        catch (_: IOException) { throw ApiException(0, "NETWORK_OFFLINE", "目前無法連線，資料將保留並在網路恢復後重新同步。") }
    }

    fun login(phone: String, password: String): String {
        val response = request(AUTH_LOGIN_PATH, "POST", JSONObject().put("phone", phone).put("password", password))
        val resolution = response.body.optJSONObject("merchant_resolution")
        if (resolution?.optBoolean("requires_selection") == true) {
            val merchants = resolution.optJSONArray("merchants").toList().map { value -> val item = value as JSONObject; item.getString("id") to item.getString("name") }
            throw MerchantSelectionRequired(resolution.getString("selection_token"), merchants)
        }
        return saveLoginResponse(response)
    }

    fun selectMerchant(selectionToken: String, merchantId: String): String {
        val response = request(AUTH_SELECT_PATH, "POST", JSONObject().put("selection_token", selectionToken).put("merchant_id", merchantId))
        return saveLoginResponse(response)
    }

    private fun saveLoginResponse(response: Response): String {
        if (!cookieJar.hasMerchantSession()) throw ApiException(response.status, "SESSION_COOKIE_MISSING", "登入成功但未收到商家 Session，請稍後再試。")
        val csrf = response.body.optString("csrf_token")
        val merchant = response.body.getJSONObject("merchant")
        store.exitDemoModeAfterMerchantAuth()
        store.saveSession("cookie-jar", csrf, merchant.getString("id"), merchant.getString("name"))
        return merchant.getString("name")
    }

    fun validateSession(): String {
        val response = request(AUTH_SESSION_PATH).body
        val csrf = response.optString("csrf_token", store.csrf())
        val merchant = response.getJSONObject("merchant")
        store.exitDemoModeAfterMerchantAuth()
        store.saveSession("cookie-jar", csrf, merchant.getString("id"), merchant.getString("name"))
        return merchant.getString("name")
    }

    fun clearSession() { cookieJar.clear(); store.clearSession() }

    fun printers(): List<PrinterConfig> = request("/api/merchant-app/printers").body.optJSONArray("printers").toList().map { value ->
        val p = value as JSONObject
        PrinterConfig(p.getString("id"), p.getString("name"), "Xprinter ${p.optString("model", "XP-N160II")}", p.getString("host"), p.getInt("port"), p.optInt("paper_width_mm", 80), p.optBoolean("enabled", true), p.optBoolean("auto_print"), p.optInt("copies", 1))
    }

    fun savePrinter(config: PrinterConfig): PrinterConfig {
        val body = JSONObject().put("id", config.id).put("name", config.name).put("host", config.host).put("port", config.port).put("enabled", config.enabled).put("auto_print", config.autoPrint).put("copies", config.copies)
        val path = if (config.id.isBlank() || config.id == "local-primary") "/api/merchant-app/printers" else "/api/merchant-app/printers/${config.id}"
        val saved = request(path, if (path.endsWith("printers")) "POST" else "PUT", body).body.getJSONObject("printer")
        return PrinterConfig(saved.getString("id"), saved.getString("name"), "Xprinter XP-N160II", saved.getString("host"), saved.getInt("port"), 80, saved.optBoolean("enabled", true), saved.optBoolean("auto_print"), saved.optInt("copies", 1)).also(store::savePrinter)
    }

    fun overviewJson(): JSONObject = request("/api/merchant-admin/ordering/overview").body.also { store.cache("overview", it.toString()) }
    fun cachedOverview(): JSONObject? = store.cached("overview")?.let { runCatching { JSONObject(it) }.getOrNull() }
    fun overview(): List<MerchantOrder> = overviewJson().optJSONArray("orders").toList().map { parseOrder(it as JSONObject) }
    fun updateOrder(code: String, status: String, cancelReason: String = "", key: String = ""): Response {
        val path = "/api/merchant-admin/ordering/orders/${enc(code)}/status"
        val body = JSONObject().put("status", status).apply { if (cancelReason.isNotBlank()) put("cancel_reason", cancelReason) }
        return queuedWhenOffline("PATCH", path, body, key.ifBlank { "order-$code-$status" })
    }
    fun confirmPayment(code: String, method: String, key: String) = request("/api/merchant-admin/ordering/orders/${enc(code)}/payment", "POST", JSONObject().put("action", "confirmed").put("payment_method", method), key)
    fun saveOrderingSettings(body: JSONObject) = request("/api/merchant-admin/ordering/settings", "PATCH", body)
    fun updateMenuItem(id: String, body: JSONObject) = request("/api/merchant-admin/ordering/items/${enc(id)}", "PATCH", body)
    fun createMenuItem(body: JSONObject) = request("/api/merchant-admin/ordering/items", "POST", body)
    fun createCategory(body: JSONObject) = request("/api/merchant-admin/ordering/categories", "POST", body)
    fun updateCategory(id: String, body: JSONObject) = request("/api/merchant-admin/ordering/categories/${enc(id)}", "PATCH", body)
    fun createQr(label: String, table: String) = request("/api/merchant-admin/ordering/qrs", "POST", JSONObject().put("label", label).put("purpose", if (table.isBlank()) "takeaway" else "dine_in").put("table_label", table)).body
    fun closeTable(id: String) = request("/api/merchant-admin/ordering/dining-sessions/${enc(id)}/close", "POST")
    fun counterOrder(body: JSONObject, key: String): JSONObject = try { request("/api/merchant-admin/ordering/orders", "POST", body, key).body }
        catch (error: ApiException) { if (error.code != "NETWORK_OFFLINE") throw error; store.enqueueMutation("POST", "/api/merchant-admin/ordering/orders", body.toString(), key); JSONObject().put("queued", true) }
    fun dashboard(): JSONObject = request("/api/merchant-admin/dashboard").body.also { store.cache("dashboard", it.toString()) }
    fun members(): JSONObject = request("/api/merchant-admin/members").body.also { store.cache("members", it.toString()) }
    fun member(id: String): JSONObject = request("/api/merchant-admin/members/${enc(id)}").body
    fun line(): JSONObject = request("/api/merchant-admin/line").body
    fun inventory(): JSONObject = request("/api/merchant-admin/inventory").body.also { store.cache("inventory", it.toString()) }
    fun reports(period: String = "today"): JSONObject = request("/api/merchant-admin/operations/reports?period=${enc(period)}").body.also { store.cache("reports_$period", it.toString()) }
    fun promotions(): JSONObject = request("/api/merchant-admin/operations/promotions").body
    fun staff(): JSONObject = request("/api/merchant-admin/operations/staff").body
    fun integrations(): JSONObject = request("/api/merchant-admin/operations/integrations").body
    fun syncPending(): Int {
        var synced = 0
        for (mutation in store.pendingMutations()) {
            try { request(mutation.path, mutation.method, JSONObject(mutation.body), mutation.key); store.mutationSynced(mutation.id); synced++ }
            catch (error: ApiException) { store.mutationFailed(mutation.id, error.message.orEmpty()); if (error.code == "NETWORK_OFFLINE") break }
        }
        return synced
    }

    fun pendingJobs(): List<PrintJob> = request("/api/merchant-app/print-jobs/pending").body.optJSONArray("jobs").toList().map { parseJob(it as JSONObject) }
    fun history(): List<PrintJob> = request("/api/merchant-app/print-jobs/history").body.optJSONArray("jobs").toList().map { parseJob(it as JSONObject) }
    fun claim(jobId: String, claimRequestId: String): PrintJob {
        val response = request("/api/merchant-app/print-jobs/${enc(jobId)}/claim", "POST", JSONObject().put("device_id", store.deviceId()).put("claim_request_id", claimRequestId)).body
        return parseJob(response.getJSONObject("job")).copy(claimToken = response.getString("claim_token"), localState = LocalJobState.CLAIMED_DURABLE, claimRequestId = claimRequestId)
    }
    fun printing(job: PrintJob) = transition(job, "printing")
    fun printed(job: PrintJob, bytes: Int) = request("/api/merchant-app/print-jobs/${enc(job.id)}/printed", "POST", JSONObject().put("claim_token", job.claimToken).put("bytes_written", bytes))
    fun failed(job: PrintJob, ambiguous: Boolean, error: Throwable) = request("/api/merchant-app/print-jobs/${enc(job.id)}/failed", "POST", JSONObject().put("claim_token", job.claimToken).put("ambiguous", ambiguous).put("error_code", error.javaClass.simpleName).put("error_message", error.message ?: "PRINT_FAILED"))
    private fun transition(job: PrintJob, action: String) = request("/api/merchant-app/print-jobs/${enc(job.id)}/$action", "POST", JSONObject().put("claim_token", job.claimToken))
    fun reprint(jobId: String, reason: String, key: String) = request("/api/merchant-app/print-jobs/${enc(jobId)}/reprint", "POST", JSONObject().put("reason", reason).put("idempotency_key", key), key)

    private fun parseOrder(o: JSONObject): MerchantOrder = MerchantOrder(o.getString("order_code"), o.optString("table_label"), o.optString("order_type"), o.optString("status"), o.optString("payment_method", "counter"), o.optInt("total_minor"), o.optString("created_at"), o.optString("customer_note"), o.optJSONArray("items").toList().map { value ->
        val i = value as JSONObject; OrderItem(i.getString("name"), i.getInt("quantity"), i.optString("note"), i.optJSONArray("options").toList().map { option -> val x = option as JSONObject; OrderOption(x.optString("group_name"), x.optString("value_name")) })
    })
    private fun parseJob(j: JSONObject): PrintJob = PrintJob(j.getString("id"), j.getString("order_code"), j.getString("printer_id"), j.optString("status"), j.optInt("copies", 1), j.optInt("attempt_count"), j.optJSONObject("payload")?.toString() ?: "{}", deliveryOutcome = j.optString("delivery_outcome"), lastError = j.optString("last_error"))
    private fun enc(value: String) = java.net.URLEncoder.encode(value, "UTF-8")

    companion object {
        const val AUTH_LOGIN_PATH = "/api/merchant-auth/login"
        const val AUTH_SELECT_PATH = "/api/merchant-auth/select"
        const val AUTH_SESSION_PATH = "/api/merchant-auth/session"
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private val EMPTY_JSON = "{}".toRequestBody(JSON)
    }

    private fun friendlyError(status: Int, server: String): String = when {
        server.isNotBlank() && server != "Not found" -> server
        status == 401 -> "登入已失效，請重新登入。"
        status == 403 -> "此帳號沒有執行這項操作的權限。"
        status == 404 -> "目前找不到這項資料，請重新整理後再試。"
        status == 409 -> "資料狀態已變更，請重新整理後再試。"
        status == 429 -> "操作過於頻繁，請稍後再試。"
        status >= 500 -> "服務暫時忙碌，請稍後再試。"
        else -> "操作未完成，請稍後再試。"
    }

    private fun queuedWhenOffline(method: String, path: String, body: JSONObject, key: String): Response = try { request(path, method, body, key) }
        catch (error: ApiException) { if (error.code != "NETWORK_OFFLINE") throw error; store.enqueueMutation(method, path, body.toString(), key); Response(202, JSONObject().put("queued", true).put("message", "待同步")) }
}

private fun JSONArray?.toList(): List<Any> = if (this == null) emptyList() else (0 until length()).map { get(it) }
