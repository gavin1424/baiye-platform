package com.baiye.merchantprinter.network

import com.baiye.merchantprinter.BuildConfig
import com.baiye.merchantprinter.data.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val status: Int, val code: String, message: String) : Exception(message)
class MerchantSelectionRequired(val selectionToken: String, val merchants: List<Pair<String, String>>) : Exception("請選擇商家")

class MerchantApi(private val store: LocalStore, private val baseUrl: String = BuildConfig.API_BASE_URL) {
    data class Response(val status: Int, val body: JSONObject, val headers: Map<String, List<String>>)

    private fun request(path: String, method: String = "GET", body: JSONObject? = null, idempotencyKey: String = ""): Response {
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        connection.requestMethod = method; connection.connectTimeout = 15_000; connection.readTimeout = 20_000
        connection.setRequestProperty("Accept", "application/json")
        if (store.cookie().isNotBlank()) connection.setRequestProperty("Cookie", store.cookie())
        if (method !in listOf("GET", "HEAD") && store.csrf().isNotBlank()) connection.setRequestProperty("X-CSRF-Token", store.csrf())
        if (idempotencyKey.isNotBlank()) connection.setRequestProperty("Idempotency-Key", idempotencyKey)
        if (body != null) { connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json"); connection.outputStream.use { it.write(body.toString().toByteArray()) } }
        val status = connection.responseCode
        val text = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
        val json = try { JSONObject(text.ifBlank { "{}" }) } catch (_: Exception) { JSONObject().put("error", text) }
        if (status !in 200..299) throw ApiException(status, json.optString("code"), json.optString("error", "連線失敗 ($status)"))
        return Response(status, json, connection.headerFields.filterKeys { it != null })
    }

    fun login(phone: String, password: String): String {
        val response = request("/api/merchant-app/auth/login", "POST", JSONObject().put("phone", phone).put("password", password))
        val resolution = response.body.optJSONObject("merchant_resolution")
        if (resolution?.optBoolean("requires_selection") == true) {
            val merchants = resolution.optJSONArray("merchants").toList().map { value -> val item = value as JSONObject; item.getString("id") to item.getString("name") }
            throw MerchantSelectionRequired(resolution.getString("selection_token"), merchants)
        }
        return saveLoginResponse(response)
    }

    fun selectMerchant(selectionToken: String, merchantId: String): String {
        val response = request("/api/merchant-app/auth/select", "POST", JSONObject().put("selection_token", selectionToken).put("merchant_id", merchantId))
        return saveLoginResponse(response)
    }

    private fun saveLoginResponse(response: Response): String {
        val setCookie = response.headers.entries.firstOrNull { it.key.equals("Set-Cookie", true) }?.value?.firstOrNull().orEmpty()
        val cookie = setCookie.substringBefore(';')
        val csrf = response.body.optString("csrf_token")
        val merchant = response.body.getJSONObject("merchant")
        store.saveSession(cookie, csrf, merchant.getString("id"), merchant.getString("name"))
        return merchant.getString("name")
    }

    fun validateSession(): String {
        val response = request("/api/merchant-app/auth/session").body
        val csrf = response.optString("csrf_token", store.csrf())
        val merchant = response.getJSONObject("merchant")
        store.saveSession(store.cookie(), csrf, merchant.getString("id"), merchant.getString("name"))
        return merchant.getString("name")
    }

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

    fun overview(): List<MerchantOrder> = request("/api/merchant-app/ordering/overview").body.optJSONArray("orders").toList().map { parseOrder(it as JSONObject) }
    fun updateOrder(code: String, status: String) = request("/api/merchant-app/ordering/orders/${enc(code)}/status", "PATCH", JSONObject().put("status", status))

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
}

private fun JSONArray?.toList(): List<Any> = if (this == null) emptyList() else (0 until length()).map { get(it) }
