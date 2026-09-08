package com.baiye.merchantprinter

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.baiye.merchantprinter.data.LocalStore
import com.baiye.merchantprinter.network.MerchantApi
import com.baiye.merchantprinter.network.PersistentCookieJar
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AuthNetworkTest {
    private lateinit var server: MockWebServer
    private lateinit var store: LocalStore

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        context.getSharedPreferences("baiye_http_cookies_v1", android.content.Context.MODE_PRIVATE).edit().clear().commit()
        context.getSharedPreferences("baiye_session_v1", android.content.Context.MODE_PRIVATE).edit().clear().commit()
        store = LocalStore(context)
        server = MockWebServer().also { it.start() }
    }

    @After fun tearDown() = server.shutdown()

    @Test
    fun productionMerchantAuthPathJsonBodyAndCookieSurviveClientRestart() {
        assertEquals("https://chuang-baiye-ai.baiye-platform.workers.dev", BuildConfig.API_BASE_URL)
        server.enqueue(MockResponse().setResponseCode(200)
            .addHeader("Content-Type", "application/json")
            .addHeader("Set-Cookie", "baiye_merchant_session=test-session; Path=/; HttpOnly; SameSite=None")
            .setBody("""{"merchant":{"id":"merchant-test","name":"百工牛肉麵"},"csrf_token":"csrf-login","merchant_resolution":{"requires_selection":false}}"""))

        val baseUrl = server.url("/").toString().trimEnd('/')
        MerchantApi(store, baseUrl, PersistentCookieJar(store.applicationContext)).login("0912345678", "12345678")
        val login = server.takeRequest()
        assertEquals("POST", login.method)
        assertEquals("/api/merchant-auth/login", login.path)
        assertEquals("application/json; charset=utf-8", login.getHeader("Content-Type"))
        assertEquals("https://baiyeconnect.com", login.getHeader("Origin"))
        val loginBody = JSONObject(login.body.readUtf8())
        assertEquals("0912345678", loginBody.getString("phone"))
        assertEquals("12345678", loginBody.getString("password"))

        server.enqueue(MockResponse().setResponseCode(200).addHeader("Content-Type", "application/json")
            .setBody("""{"merchant":{"id":"merchant-test","name":"百工牛肉麵"},"csrf_token":"csrf-session"}"""))
        MerchantApi(store, baseUrl, PersistentCookieJar(store.applicationContext)).validateSession()
        val session = server.takeRequest()
        assertEquals("GET", session.method)
        assertEquals("/api/merchant-auth/session", session.path)
        assertTrue(session.getHeader("Cookie").orEmpty().contains("baiye_merchant_session=test-session"))
    }
}
