package com.baiye.merchantprinter.network

import android.content.Context
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import org.json.JSONArray
import org.json.JSONObject

/** Persists HttpOnly merchant session cookies across app and process restarts. */
class PersistentCookieJar(context: Context) : CookieJar {
    private val preferences = context.getSharedPreferences("baiye_http_cookies_v1", Context.MODE_PRIVATE)
    private val cookies = linkedMapOf<String, Cookie>()

    init {
        runCatching {
            val values = JSONArray(preferences.getString(KEY, "[]") ?: "[]")
            for (index in 0 until values.length()) decode(values.getJSONObject(index))?.let { cookies[id(it)] = it }
        }
        removeExpiredAndPersist()
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { cookie ->
            val key = id(cookie)
            if (cookie.expiresAt <= System.currentTimeMillis()) this.cookies.remove(key) else this.cookies[key] = cookie
        }
        persist()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        removeExpiredAndPersist()
        return cookies.values.filter { it.matches(url) }
    }

    @Synchronized
    fun hasMerchantSession(): Boolean = cookies.values.any {
        it.name == MERCHANT_SESSION && it.expiresAt > System.currentTimeMillis()
    }

    @Synchronized
    fun clear() {
        cookies.clear()
        preferences.edit().remove(KEY).apply()
    }

    private fun removeExpiredAndPersist() {
        if (cookies.entries.removeAll { it.value.expiresAt <= System.currentTimeMillis() }) persist()
    }

    private fun persist() {
        val values = JSONArray()
        cookies.values.forEach { cookie ->
            values.put(JSONObject()
                .put("name", cookie.name).put("value", cookie.value)
                .put("domain", cookie.domain).put("path", cookie.path)
                .put("expiresAt", cookie.expiresAt).put("secure", cookie.secure)
                .put("httpOnly", cookie.httpOnly).put("hostOnly", cookie.hostOnly)
                .put("persistent", cookie.persistent))
        }
        preferences.edit().putString(KEY, values.toString()).apply()
    }

    private fun decode(value: JSONObject): Cookie? = runCatching {
        Cookie.Builder()
            .name(value.getString("name"))
            .value(value.getString("value"))
            .apply {
                if (value.optBoolean("hostOnly")) hostOnlyDomain(value.getString("domain")) else domain(value.getString("domain"))
                path(value.optString("path", "/"))
                if (value.optBoolean("persistent")) expiresAt(value.getLong("expiresAt"))
                if (value.optBoolean("secure")) secure()
                if (value.optBoolean("httpOnly")) httpOnly()
            }
            .build()
    }.getOrNull()

    private fun id(cookie: Cookie) = "${cookie.name}|${cookie.domain}|${cookie.path}"

    companion object {
        private const val KEY = "cookies"
        private const val MERCHANT_SESSION = "baiye_merchant_session"
    }
}
