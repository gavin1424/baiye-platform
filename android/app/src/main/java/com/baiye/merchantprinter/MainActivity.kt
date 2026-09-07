package com.baiye.merchantprinter

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.baiye.merchantprinter.data.*
import com.baiye.merchantprinter.network.MerchantApi
import com.baiye.merchantprinter.network.MerchantSelectionRequired
import com.baiye.merchantprinter.printer.*
import com.baiye.merchantprinter.service.PrintService
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = LocalStore(this); val api = MerchantApi(store)
        if (store.printer()?.autoPrint == true && store.hasSession()) PrintService.start(this)
        setContent { BaiyeTheme { MerchantPrinterApp(store, api) } }
    }
}

private enum class Screen { HOME, SETTINGS, ORDERS, HISTORY }

@Composable private fun BaiyeTheme(content: @Composable () -> Unit) {
    val colors = lightColorScheme(primary = Color(0xFF8B4513), secondary = Color(0xFFD97706), background = Color(0xFFFFF8EE), surface = Color.White)
    MaterialTheme(colorScheme = colors, typography = Typography(), content = content)
}

@Composable fun MerchantPrinterApp(store: LocalStore, api: MerchantApi) {
    var loggedIn by remember { mutableStateOf(store.hasSession()) }
    if (!loggedIn) { LoginScreen(api) { loggedIn = true }; return }
    var screen by remember { mutableStateOf(Screen.HOME) }
    when (screen) {
        Screen.HOME -> HomeScreen(store, api, onNavigate = { screen = it })
        Screen.SETTINGS -> SettingsScreen(store, api, onBack = { screen = Screen.HOME })
        Screen.ORDERS -> OrdersScreen(api, onBack = { screen = Screen.HOME })
        Screen.HISTORY -> HistoryScreen(api, onBack = { screen = Screen.HOME })
    }
}

@Composable private fun LoginScreen(api: MerchantApi, onSuccess: () -> Unit) {
    var phone by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }; var message by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }
    var selectionToken by remember { mutableStateOf("") }; var merchants by remember { mutableStateOf(emptyList<Pair<String,String>>()) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    DisposableEffect(Unit) { onDispose { executor.shutdownNow() } }
    Surface(Modifier.fillMaxSize()) { Column(Modifier.padding(28.dp).testTag("login-screen"), verticalArrangement = Arrangement.Center) {
        Text("創百業商家出單", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text("使用現有商家帳號登入", modifier = Modifier.padding(vertical = 16.dp))
        OutlinedTextField(phone, { phone = it }, label = { Text("手機號碼") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("login-phone"))
        OutlinedTextField(password, { password = it }, label = { Text("8 位數字密碼") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 10.dp).testTag("login-password"))
        Button(onClick = { busy = true; message = ""; executor.execute { try { api.login(phone, password); runOnMain { busy = false; onSuccess() } } catch (e: MerchantSelectionRequired) { runOnMain { busy = false; selectionToken = e.selectionToken; merchants = e.merchants } } catch (e: Exception) { runOnMain { busy = false; message = e.message.orEmpty() } } } }, enabled = !busy, modifier = Modifier.fillMaxWidth().padding(top = 18.dp).testTag("login-submit")) { Text(if (busy) "登入中…" else "登入") }
        if (merchants.isNotEmpty()) { Text("請選擇要使用的商家：", modifier = Modifier.padding(top = 14.dp)); merchants.forEach { merchant -> OutlinedButton({ busy = true; executor.execute { try { api.selectMerchant(selectionToken, merchant.first); runOnMain { busy = false; onSuccess() } } catch(e: Exception) { runOnMain { busy = false; message = e.message.orEmpty() } } } }, Modifier.fillMaxWidth()) { Text(merchant.second) } } }
        if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp))
    } }
}

@Composable private fun HomeScreen(store: LocalStore, api: MerchantApi, onNavigate: (Screen) -> Unit) {
    var orders by remember { mutableStateOf(emptyList<MerchantOrder>()) }; var printer by remember { mutableStateOf(store.printer()) }; var status by remember { mutableStateOf(PrinterReachability.UNKNOWN) }; var message by remember { mutableStateOf("") }
    val executor = remember { Executors.newSingleThreadExecutor() }
    fun refresh() = executor.execute { try { val loaded = api.overview(); val remotePrinter = api.printers().firstOrNull(); remotePrinter?.let(store::savePrinter); runOnMain { orders = loaded; printer = remotePrinter ?: printer } } catch (e: Exception) { runOnMain { message = e.message.orEmpty() } } }
    LaunchedEffect(Unit) { refresh() }; DisposableEffect(Unit) { onDispose { executor.shutdownNow() } }
    LazyColumn(Modifier.fillMaxSize().padding(18.dp).testTag("home-screen"), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("創百業商家出單", fontSize = 29.sp, fontWeight = FontWeight.Bold); Text(store.merchantName().ifBlank { "百工牛肉麵" }, fontSize = 20.sp, color = MaterialTheme.colorScheme.primary) }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatCard("新訂單", orders.count { it.status == "submitted" }, Modifier.weight(1f)); StatCard("製作中", orders.count { it.status in listOf("accepted","preparing") }, Modifier.weight(1f)); StatCard("已完成", orders.count { it.status in listOf("ready","served","completed") }, Modifier.weight(1f))
        } }
        item { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(18.dp)) {
            Text(printer?.name ?: "XP-N160II", fontWeight = FontWeight.Bold, fontSize = 20.sp); Text(printer?.let { "${it.host}:${it.port}" } ?: "尚未設定")
            Text(when(status) { PrinterReachability.NETWORK_REACHABLE -> "● Network reachable"; PrinterReachability.OFFLINE -> "● 未連線"; PrinterReachability.ERROR -> "● 錯誤"; else -> "● UNKNOWN" }, color = if(status == PrinterReachability.NETWORK_REACHABLE) Color(0xFF16803B) else Color.DarkGray)
            Text("Auto Print：${if (printer?.autoPrint == true) "ON" else "OFF"}", fontWeight = FontWeight.Bold)
            Text("網路可達不代表紙張、上蓋或切刀狀態正常。", fontSize = 12.sp)
        } } }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button({ val config = printer ?: return@Button; executor.execute { try { LanEscPosPrinter().test(config); runOnMain { status = PrinterReachability.NETWORK_REACHABLE } } catch (_: Exception) { runOnMain { status = PrinterReachability.OFFLINE } } } }, Modifier.weight(1f)) { Text("測試連線") }
            Button({ val config = printer ?: PrinterConfig(); executor.execute { try { val bytes = EscPosRenderer().testReceipt(); MockPrinter(LocalContextHolder.context!!).print(config, bytes); runOnMain { message = "Mock 測試列印已儲存" } } catch (e: Exception) { runOnMain { message = e.message.orEmpty() } } } }, Modifier.weight(1f).testTag("mock-test-print")) { Text("Mock 測試列印") }
        } }
        item { Button({ onNavigate(Screen.SETTINGS) }, Modifier.fillMaxWidth().testTag("printer-settings")) { Text("印表機設定") }; Button({ onNavigate(Screen.ORDERS) }, Modifier.fillMaxWidth().testTag("today-orders")) { Text("今日訂單") }; OutlinedButton({ onNavigate(Screen.HISTORY) }, Modifier.fillMaxWidth().testTag("print-history")) { Text("列印紀錄") }; if (message.isNotBlank()) Text(message) }
    }
    LocalContextHolder.context = androidx.compose.ui.platform.LocalContext.current
}

private object LocalContextHolder { var context: android.content.Context? = null }

@Composable private fun StatCard(label: String, count: Int, modifier: Modifier) = Card(modifier) { Column(Modifier.padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(label, fontSize = 13.sp); Text(count.toString(), fontSize = 28.sp, fontWeight = FontWeight.Bold) } }

@Composable private fun SettingsScreen(store: LocalStore, api: MerchantApi, onBack: () -> Unit) {
    val initial = store.printer() ?: PrinterConfig(); var name by remember { mutableStateOf(initial.name) }; var host by remember { mutableStateOf(initial.host) }; var port by remember { mutableStateOf(initial.port.toString()) }; var auto by remember { mutableStateOf(initial.autoPrint) }; var copies by remember { mutableStateOf(initial.copies.toString()) }; var message by remember { mutableStateOf("") }; var id by remember { mutableStateOf(initial.id) }
    val executor = remember { Executors.newSingleThreadExecutor() }; val context = androidx.compose.ui.platform.LocalContext.current
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    DisposableEffect(Unit) { onDispose { executor.shutdownNow() } }
    fun config() = PrinterConfig(id, name, "Xprinter XP-N160II", host, port.toIntOrNull() ?: 0, 80, true, auto, copies.toIntOrNull()?.coerceIn(1,5) ?: 1)
    LazyColumn(Modifier.fillMaxSize().padding(18.dp).testTag("settings-screen"), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("印表機設定", fontSize = 28.sp, fontWeight = FontWeight.Bold); Text("型號：Xprinter XP-N160II\n連線方式：LAN\n紙寬：80mm") }
        item { OutlinedTextField(name, { name = it }, modifier = Modifier.fillMaxWidth(), label = { Text("名稱") }); OutlinedTextField(host, { host = it }, modifier = Modifier.fillMaxWidth().testTag("printer-host"), label = { Text("IP Address") }); OutlinedTextField(port, { port = it }, modifier = Modifier.fillMaxWidth().testTag("printer-port"), label = { Text("Port（可修改）") }); OutlinedTextField(copies, { copies = it }, modifier = Modifier.fillMaxWidth(), label = { Text("份數 1–5") }); Row(verticalAlignment = Alignment.CenterVertically) { Switch(auto, { auto = it }); Text("自動出單") } }
        item { Button({ executor.execute { try { LanEscPosPrinter().test(config()); runOnMain { message = "Network reachable（僅代表 TCP 可連）" } } catch(e: Exception) { runOnMain { message = "未連線：${e.message}" } } } }, Modifier.fillMaxWidth()) { Text("測試連線") }
            Button({ executor.execute { try { LanEscPosPrinter().print(config(), EscPosRenderer().testReceipt()); runOnMain { message = "測試資料已送出；請人工確認紙本" } } catch(e: Exception) { runOnMain { message = e.message.orEmpty() } } } }, Modifier.fillMaxWidth()) { Text("測試列印") }
            Button({ if (auto && android.os.Build.VERSION.SDK_INT >= 33) notificationPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS); executor.execute { try { val saved = api.savePrinter(config()); store.savePrinter(saved); if(saved.autoPrint) PrintService.start(context); runOnMain { id = saved.id; message = "已儲存" } } catch(e: Exception) { runOnMain { message = e.message.orEmpty() } } } }, Modifier.fillMaxWidth().testTag("printer-save")) { Text("儲存") }
            OutlinedButton(onBack, Modifier.fillMaxWidth()) { Text("返回") }; if(message.isNotBlank()) Text(message) }
    } }

@Composable private fun OrdersScreen(api: MerchantApi, onBack: () -> Unit) {
    var orders by remember { mutableStateOf(emptyList<MerchantOrder>()) }; var tab by remember { mutableStateOf(0) }; var message by remember { mutableStateOf("") }; val executor = remember { Executors.newSingleThreadExecutor() }
    fun load() = executor.execute { try { val value = api.overview(); runOnMain { orders = value } } catch(e: Exception) { runOnMain { message = e.message.orEmpty() } } }
    LaunchedEffect(Unit) { load() }; DisposableEffect(Unit) { onDispose { executor.shutdownNow() } }
    val groups = listOf(listOf("submitted"), listOf("accepted","preparing"), listOf("ready","served","completed")); val labels = listOf("新訂單","製作中","已完成")
    Column(Modifier.fillMaxSize().padding(14.dp).testTag("orders-screen")) { Text("今日訂單", fontSize = 28.sp, fontWeight = FontWeight.Bold); TabRow(tab) { labels.forEachIndexed { i, label -> Tab(tab == i, { tab = i }, text = { Text(label) }) } }
        LazyColumn(Modifier.weight(1f)) { items(orders.filter { it.status in groups[tab] }, key = { it.code }) { order -> OrderCard(order) { next -> executor.execute { try { api.updateOrder(order.code, next); load() } catch(e: Exception) { runOnMain { message=e.message.orEmpty() } } } } } }
        if(message.isNotBlank()) Text(message); OutlinedButton(onBack, Modifier.fillMaxWidth()) { Text("返回") }
    }
}

@Composable private fun OrderCard(order: MerchantOrder, advance: (String) -> Unit) {
    val next = when(order.status) { "submitted" -> "accepted"; "accepted" -> "preparing"; "preparing" -> "ready"; "ready" -> "served"; "served" -> "completed"; else -> null }
    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp)) { Column(Modifier.padding(14.dp)) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(order.table.ifBlank { "外帶" }, fontSize = 34.sp, fontWeight = FontWeight.Bold); Text(order.code.substringAfterLast('-')); }; order.items.forEach { Text("${it.quantity}  ${it.name}", fontSize = 18.sp, fontWeight = FontWeight.SemiBold) }; Text("NT$ ${order.totalMinor / 100}", fontSize = 22.sp, fontWeight = FontWeight.Bold); next?.let { Button({ advance(it) }, Modifier.fillMaxWidth()) { Text(if(it=="accepted") "接單" else if(it=="ready") "完成" else "下一步") } } } }
}

@Composable private fun HistoryScreen(api: MerchantApi, onBack: () -> Unit) {
    var jobs by remember { mutableStateOf(emptyList<PrintJob>()) }; var confirm by remember { mutableStateOf<PrintJob?>(null) }; var message by remember { mutableStateOf("") }; val executor = remember { Executors.newSingleThreadExecutor() }
    fun load() = executor.execute { try { val value=api.history(); runOnMain { jobs=value } } catch(e:Exception){ runOnMain{ message=e.message.orEmpty() } } }
    LaunchedEffect(Unit){load()}; DisposableEffect(Unit){onDispose{executor.shutdownNow()}}
    Column(Modifier.fillMaxSize().padding(14.dp).testTag("history-screen")){ Text("列印紀錄",fontSize=28.sp,fontWeight=FontWeight.Bold); LazyColumn(Modifier.weight(1f)){items(jobs,key={it.id}){job->Card(Modifier.fillMaxWidth().padding(vertical=5.dp)){Row(Modifier.padding(12.dp).fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Column{Text(job.orderCode,fontWeight=FontWeight.Bold);Text("${job.status} • ${job.deliveryOutcome}");if(job.deliveryOutcome=="ambiguous")Text("可能已列印，請確認後補印",color=MaterialTheme.colorScheme.error)};OutlinedButton({confirm=job}){Text("補印")}}}}}; if(message.isNotBlank())Text(message);OutlinedButton(onBack,Modifier.fillMaxWidth()){Text("返回")}}
    confirm?.let { job -> AlertDialog(onDismissRequest={confirm=null},title={Text("確認補印")},text={Text("確定要重新列印訂單 ${job.orderCode}？\n將標註【補印】並保留紀錄。")},confirmButton={Button({confirm=null;executor.execute{try{api.reprint(job.id,"商家於 Android App 人工確認補印","android-reprint-${UUID.randomUUID()}");load()}catch(e:Exception){runOnMain{message=e.message.orEmpty()}}}}){Text("確定補印")}},dismissButton={TextButton({confirm=null}){Text("取消")}}) }
}

private fun runOnMain(block: () -> Unit) = android.os.Handler(android.os.Looper.getMainLooper()).post(block)
