package com.baiye.merchantprinter

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import com.baiye.merchantprinter.data.LocalStore
import com.baiye.merchantprinter.data.PrinterConfig
import com.baiye.merchantprinter.network.MerchantApi
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.io.File

class ScreenshotQaTest {
    @get:Rule val compose = createComposeRule()
    private lateinit var store: LocalStore
    private lateinit var output: File

    @Before fun setUp() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        context.deleteDatabase("baiye_printer_v1.db")
        store = LocalStore(context)
        store.saveSession("qa-cookie", "qa-csrf", "merchant-qa", "百工牛肉麵｜完整功能試用店與很長的分店名稱")
        store.savePrinter(PrinterConfig(id = "printer-qa", name = "XP-N160II 廚房出單機", host = "192.168.1.200", autoPrint = true))
        store.setOnboardingDone()
        store.setDemoModeForQa(true)
        output = File(context.getExternalFilesDir(null), "qa").also { it.mkdirs() }
        compose.setContent { MerchantPrinterApp(store, MerchantApi(store, "http://127.0.0.1:9")) }
        compose.waitUntil(5_000) { compose.onAllNodesWithText("今日統計").fetchSemanticsNodes().isNotEmpty() }
    }

    private fun capture(name: String) {
        compose.waitForIdle()
        Thread.sleep(400)
        check(UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).takeScreenshot(File(output, "$name.png")))
    }

    @Test fun captureHome() = capture("01-home")

    @Test fun captureReports() {
        compose.onAllNodesWithText("更多").onLast().performClick()
        compose.onNodeWithText("營運報表").performClick()
        compose.onNodeWithTag("reports-screen").assertExists()
        capture("02-reports")
    }

    @Test fun captureMenu() {
        compose.onAllNodesWithText("菜單").onLast().performClick()
        compose.onNodeWithTag("menu-screen").assertExists()
        capture("03-menu")
    }

    @Test fun capturePosAndCart() {
        compose.onAllNodesWithText("開單").onLast().performClick()
        compose.onNodeWithTag("pos-screen").assertExists()
        val width = InstrumentationRegistry.getInstrumentation().targetContext.resources.configuration.screenWidthDp
        capture(if (width >= 720) "06-pos-tablet" else "04-pos")
        if (width < 720) {
            compose.onAllNodesWithText("招牌牛肉麵 1").onFirst().performClick()
            compose.onNodeWithTag("open-cart").performClick()
            compose.onNodeWithText("購物車").assertExists()
            capture("05-cart-sheet")
            compose.onNodeWithText("訂單備註").performClick()
            Thread.sleep(800)
            capture("05b-cart-keyboard")
        }
    }

    @Test fun captureOfflineState() {
        store.setDemoModeForQa(false)
        compose.onNodeWithContentDescription("重新整理").performClick()
        compose.waitUntil(5_000) { compose.onAllNodesWithText("離線，顯示上次同步資料").fetchSemanticsNodes().isNotEmpty() }
        capture("07-offline")
    }
}
