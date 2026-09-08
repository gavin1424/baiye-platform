package com.baiye.merchantprinter

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.core.app.ApplicationProvider
import com.baiye.merchantprinter.data.LocalStore
import com.baiye.merchantprinter.data.PrinterConfig
import com.baiye.merchantprinter.network.MerchantApi
import com.baiye.merchantprinter.printer.EscPosRenderer
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class ScreensSmokeTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var store: LocalStore

    @Before fun setUp() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        context.deleteDatabase("baiye_printer_v1.db")
        store = LocalStore(context)
        store.saveSession("cookie-jar", "csrf", "merchant-test", "百工牛肉麵")
        store.savePrinter(PrinterConfig(id = "printer-test", host = "192.0.2.1"))
        store.setOnboardingDone()
        store.setDemoMode(true)
        compose.setContent { MerchantPrinterApp(store, MerchantApi(store, "http://127.0.0.1:9")) }
    }

    @Test fun appShellOrderPosMenuAndOperationsAreReachable() {
        compose.onNodeWithTag("home-screen").assertIsDisplayed()
        compose.onAllNodesWithText("開單").onLast().performClick()
        compose.onNodeWithTag("pos-screen").assertIsDisplayed()
        compose.onAllNodesWithText("訂單").onLast().performClick()
        compose.onNodeWithTag("orders-screen").assertIsDisplayed()
        compose.onAllNodesWithText("菜單").onLast().performClick()
        compose.onNodeWithTag("menu-screen").assertIsDisplayed()
        compose.onAllNodesWithText("更多").onLast().performClick()
        compose.onNodeWithTag("more-screen").assertIsDisplayed()
        compose.onNodeWithText("印表機").performClick()
        compose.onNodeWithTag("printer-settings").assertIsDisplayed()
        compose.onNodeWithText("Mock 測試列印").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Mock 測試單已保存").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Mock 測試單已保存").assertExists()
    }

    @Test fun traditionalChineseLongReceiptRendersRasterAndCut() {
        val options = JSONArray().put(JSONObject().put("group_name", "麵條").put("value_name", "粗麵")).put(JSONObject().put("group_name", "辣度").put("value_name", "小辣"))
        val item = JSONObject().put("name", "超長品名招牌紅燒半筋半肉牛肉麵加大份").put("quantity", 20).put("note", "不要蔥不要蒜而且湯與麵分開放").put("options", options)
        val payload = JSONObject().put("merchant_name", "百工牛肉麵").put("order_code", "A1-0086").put("table_label", "A1").put("order_type", "dine_in").put("payment_method", "counter").put("total_minor", 57000).put("created_at", "2026-09-08T06:42:00+08:00").put("items", JSONArray().put(item))
        val bytes = EscPosRenderer().kitchen(payload.toString())
        assertTrue(bytes.size > 10_000)
        assertTrue(bytes.takeLast(4).toByteArray().contentEquals(byteArrayOf(0x1D,0x56,0x42,0x00)))
    }
}
