@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:android.annotation.SuppressLint("LocalContextConfigurationRead")

package com.baiye.merchantprinter

import android.content.Intent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.provider.MediaStore
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.baiye.merchantprinter.data.LocalStore
import com.baiye.merchantprinter.data.PrinterConfig
import com.baiye.merchantprinter.data.PrintJob
import com.baiye.merchantprinter.network.MerchantApi
import com.baiye.merchantprinter.network.MerchantSelectionRequired
import com.baiye.merchantprinter.network.ApiException
import com.baiye.merchantprinter.printer.EscPosRenderer
import com.baiye.merchantprinter.printer.LanEscPosPrinter
import com.baiye.merchantprinter.service.PrintService
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

private enum class MainTab(val label: String) { HOME("首頁"), ORDERS("訂單"), POS("開單"), MENU("菜單"), MORE("更多") }
private enum class MorePage(val title: String) { ROOT("更多"), TABLES("桌位與 QR"), KDS("廚房看板"), MEMBERS("會員中心"), REPORTS("營運報表"), STORE("店舖設定"), PRINTER("印表機"), PRINT_HISTORY("列印紀錄"), PROMOTIONS("優惠與折扣"), CALLING("叫號"), STAFF("員工權限"), INTEGRATIONS("整合服務"), ABOUT("關於點餐靈") }
private enum class OrderingState { ONLINE, OFFLINE, SYNCING }
private enum class ReportsState { FRESH, STALE, ERROR }

@Composable
fun DiningSpiritApp(store: LocalStore, api: MerchantApi) {
    DiningSpiritTheme {
        val context = LocalContext.current
        var loggedIn by remember { mutableStateOf(store.hasSession()) }
        LaunchedEffect(loggedIn) {
            if (loggedIn) try {
                withContext(Dispatchers.IO) { api.validateSession() }
                if (store.printer()?.autoPrint == true) PrintService.start(context)
            } catch (error: ApiException) { if (error.status == 401) { api.clearSession(); loggedIn = false } }
        }
        if (!loggedIn) { SpiritLogin(api) { loggedIn=true }; return@DiningSpiritTheme }
        if (!store.onboardingDone()) { Onboarding(store) { store.setOnboardingDone() }; return@DiningSpiritTheme }
        OperationsShell(store,api) { api.clearSession(); loggedIn=false }
    }
}

@Composable private fun SpiritLogin(api: MerchantApi,onSuccess:()->Unit) {
    var phone by remember{mutableStateOf("")}; var password by remember{mutableStateOf("")}; var busy by remember{mutableStateOf(false)}; var error by remember{mutableStateOf("")}; var selection by remember{mutableStateOf("")}; var merchants by remember{mutableStateOf(emptyList<Pair<String,String>>())}; val scope=rememberCoroutineScope()
    Surface(Modifier.fillMaxSize().testTag("login-screen")) { Box(Modifier.fillMaxSize().padding(28.dp),contentAlignment=Alignment.Center) { Card(Modifier.widthIn(max=480.dp)) { Column(Modifier.padding(28.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        Text("點餐靈",fontSize=40.sp,fontWeight=FontWeight.Black,color=MaterialTheme.colorScheme.primary); Text("創百業智慧餐飲管理系統",fontSize=18.sp,fontWeight=FontWeight.SemiBold); Text("登入後開始管理今天的訂單",color=MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(phone,{phone=it.filter(Char::isDigit).take(10)},label={Text("手機號碼")},singleLine=true,modifier=Modifier.fillMaxWidth().testTag("login-phone"))
        OutlinedTextField(password,{password=it.filter(Char::isDigit).take(8)},label={Text("8 位數字密碼")},singleLine=true,visualTransformation=PasswordVisualTransformation(),modifier=Modifier.fillMaxWidth().testTag("login-password"))
        Button({busy=true;error="";scope.launch{try{withContext(Dispatchers.IO){api.login(phone,password)};onSuccess()}catch(e:MerchantSelectionRequired){selection=e.selectionToken;merchants=e.merchants}catch(e:Exception){error=e.message?:"登入未完成，請稍後再試。"}finally{busy=false}}},enabled=!busy&&phone.length>=10&&password.length==8,modifier=Modifier.fillMaxWidth().heightIn(min=52.dp).testTag("login-submit")){Text(if(busy)"正在登入…" else "登入")}
        merchants.forEach { merchant->OutlinedButton({scope.launch{busy=true;try{withContext(Dispatchers.IO){api.selectMerchant(selection,merchant.first)};onSuccess()}catch(e:Exception){error=e.message.orEmpty()}finally{busy=false}}},Modifier.fillMaxWidth().heightIn(min=48.dp)){Text(merchant.second)} }
        if(error.isNotBlank()) AssistChip({},label={Text(error)},colors=AssistChipDefaults.assistChipColors(labelColor=MaterialTheme.colorScheme.error))
    } } } }
}

@Composable private fun Onboarding(store:LocalStore,onDone:()->Unit) {
    val steps=listOf("確認商店資料" to "確認名稱、地址與聯絡資訊","建立菜單" to "設定分類、商品、規格與售價","建立桌號 QR" to "每桌使用不可猜測的安全點餐碼","設定 XP-N160II" to "輸入區域網路 IP 與 Port","測試訂單" to "確認接單、廚房單與切紙流程"); var step by remember{mutableIntStateOf(0)}
    Surface(Modifier.fillMaxSize()) { Column(Modifier.padding(28.dp).fillMaxSize(),verticalArrangement=Arrangement.Center) { Text("點餐靈開店導覽",fontSize=30.sp,fontWeight=FontWeight.Bold); LinearProgressIndicator({(step+1)/steps.size.toFloat()},Modifier.fillMaxWidth().padding(vertical=20.dp)); Text("Step ${step+1}",color=MaterialTheme.colorScheme.primary); Text(steps[step].first,fontSize=28.sp,fontWeight=FontWeight.Bold); Text(steps[step].second,Modifier.padding(vertical=12.dp),color=MaterialTheme.colorScheme.onSurfaceVariant); Button({if(step<steps.lastIndex)step++ else onDone()},Modifier.fillMaxWidth().heightIn(min=52.dp)){Text(if(step==steps.lastIndex)"點餐靈已準備完成" else "下一步")}; if(step>0)TextButton({step--},Modifier.fillMaxWidth()){Text("上一步")} } }
}

@Composable
private fun OperationsShell(store: LocalStore, api: MerchantApi, onLogout: () -> Unit) {
    var tab by remember { mutableStateOf(MainTab.HOME) }
    var more by remember { mutableStateOf(MorePage.ROOT) }
    var overview by remember { mutableStateOf(api.cachedOverview() ?: emptyOverview()) }
    var dashboard by remember { mutableStateOf(store.cached("dashboard")?.jsonOrNull() ?: JSONObject()) }
    var report by remember { mutableStateOf(store.cached("reports_today")?.jsonOrNull() ?: JSONObject()) }
    var ordering by remember { mutableStateOf(OrderingState.SYNCING) }
    var reportsState by remember { mutableStateOf(if (store.cached("reports_today") == null) ReportsState.ERROR else ReportsState.STALE) }
    var message by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    suspend fun refreshOrdering() {
        if (store.demoMode()) {
            overview = demoOverview(); ordering = OrderingState.ONLINE; message = ""
            return
        }
        ordering = OrderingState.SYNCING
        try {
            val nextOverview = withContext(Dispatchers.IO) {
                runCatching { api.syncPending() }
                api.overviewJson()
            }
            val responseMerchantId = nextOverview.optString("merchant_id")
            if (responseMerchantId != store.merchantId()) throw ApiException(403, "MERCHANT_SCOPE_MISMATCH", "訂單所屬商家與登入商家不一致，已停止同步。")
            overview = nextOverview
            nextOverview.array("orders").filter { it.text("status") == "submitted" && it.isRecent() }.forEach { notifyNewOrder(context, store, it) }
            store.setLastSync(System.currentTimeMillis())
            ordering = OrderingState.ONLINE
            message = ""
        } catch (error: Exception) {
            ordering = OrderingState.OFFLINE
            message = error.message.orEmpty()
        }
    }

    suspend fun refreshSecondary() {
        if (store.demoMode()) {
            dashboard = demoDashboard(); report = demoReport(); reportsState = ReportsState.FRESH
            return
        }
        runCatching { withContext(Dispatchers.IO) { api.dashboard() } }.onSuccess { dashboard = it }
        runCatching { withContext(Dispatchers.IO) { api.reports() } }
            .onSuccess { report = it; reportsState = ReportsState.FRESH }
            .onFailure { reportsState = if (store.cached("reports_today") == null) ReportsState.ERROR else ReportsState.STALE }
    }

    suspend fun refreshNow() {
        refreshOrdering()
        refreshSecondary()
    }

    fun refresh() {
        scope.launch { refreshNow() }
    }

    LaunchedEffect(Unit) {
        refreshNow()
        while (isActive) {
            delay(3_000)
            refreshOrdering()
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val tablet = maxWidth >= 720.dp
        val selectTab: (MainTab) -> Unit = { selected -> tab = selected; if (selected != MainTab.MORE) more = MorePage.ROOT }
        if (tablet) {
            Row(Modifier.fillMaxSize()) {
                NavigationRail(containerColor = MaterialTheme.colorScheme.surface) {
                    Spacer(Modifier.height(24.dp))
                    MainTab.entries.forEach { item ->
                        NavigationRailItem(tab == item, { selectTab(item) }, icon = { NavigationIcon(item) }, label = { Text(item.label) })
                    }
                }
                ContentArea(tab, more, { more = it }, selectTab, overview, dashboard, report, ordering, reportsState, message, store, api, ::refresh, onLogout, Modifier.weight(1f))
            }
        } else {
            Scaffold(
                containerColor = MaterialTheme.colorScheme.background,
                contentWindowInsets = WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal),
                bottomBar = {
                    NavigationBar(windowInsets = NavigationBarDefaults.windowInsets, tonalElevation = 0.dp, containerColor = MaterialTheme.colorScheme.surface) {
                        MainTab.entries.forEach { item ->
                            NavigationBarItem(tab == item, { selectTab(item) }, icon = { NavigationIcon(item) }, label = { Text(item.label) })
                        }
                    }
                }
            ) { innerPadding ->
                ContentArea(tab, more, { more = it }, selectTab, overview, dashboard, report, ordering, reportsState, message, store, api, ::refresh, onLogout, Modifier.padding(innerPadding))
            }
        }
    }
}

@Composable
private fun NavigationIcon(tab: MainTab) {
    val image = when (tab) {
        MainTab.HOME -> Icons.Default.Home
        MainTab.ORDERS -> Icons.Default.ReceiptLong
        MainTab.POS -> Icons.Default.Add
        MainTab.MENU -> Icons.Default.RestaurantMenu
        MainTab.MORE -> Icons.Default.MoreHoriz
    }
    Icon(image, contentDescription = tab.label)
}

@Composable
private fun ContentArea(
    tab: MainTab, more: MorePage, setMore: (MorePage) -> Unit, setTab: (MainTab) -> Unit,
    overview: JSONObject, dashboard: JSONObject, report: JSONObject, ordering: OrderingState, reportsState: ReportsState, message: String,
    store: LocalStore, api: MerchantApi, refresh: () -> Unit, onLogout: () -> Unit, modifier: Modifier
) {
    Column(modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        TopBrand(store.merchantName(), ordering, store.pendingCount(), refresh)
        if (ordering == OrderingState.OFFLINE) OfflineBanner(store.lastSync(), message, refresh)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) {
                MainTab.HOME -> DashboardScreen(overview, report, store, ordering) { action ->
                    when (action) {
                        "POS" -> setTab(MainTab.POS)
                        "MENU" -> setTab(MainTab.MENU)
                        "QR" -> { setTab(MainTab.MORE); setMore(MorePage.TABLES) }
                        "REPORT" -> { setTab(MainTab.MORE); setMore(MorePage.REPORTS) }
                    }
                }
                MainTab.ORDERS -> OrderCenter(overview, api, refresh)
                MainTab.POS -> PosScreen(overview, api, refresh, ordering)
                MainTab.MENU -> MenuScreen(overview, api, refresh, store.demoMode())
                MainTab.MORE -> MoreHost(more, setMore, overview, dashboard, report, reportsState, store, api, refresh, onLogout)
            }
        }
    }
}

@Composable
private fun TopBrand(merchant: String, ordering: OrderingState, pending: Int, refresh: () -> Unit) {
    var showMerchant by remember { mutableStateOf(false) }
    Surface(color = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
        BoxWithConstraints(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp)) {
            val stacked = maxWidth < 360.dp || LocalDensity.current.fontScale >= 1.7f
            Column(Modifier.fillMaxWidth()) {
                val status: @Composable () -> Unit = {
                    val online = ordering == OrderingState.ONLINE
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (online) Icons.Default.CloudDone else Icons.Default.CloudOff, contentDescription = null, tint = if (online) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                        Spacer(Modifier.width(4.dp))
                        Text(when (ordering) { OrderingState.ONLINE -> "訂單連線"; OrderingState.OFFLINE -> "訂單離線"; OrderingState.SYNCING -> "訂單同步中" }, style = MaterialTheme.typography.labelLarge)
                        IconButton(refresh, Modifier.size(48.dp)) { Icon(Icons.Default.Refresh, contentDescription = "重新整理") }
                    }
                }
                if (stacked) {
                    Text("點餐靈", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) { status() }
                } else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("點餐靈", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
                    status()
                }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        merchant.ifBlank { "商家營運中心" }, maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f).clickable { showMerchant = true }.padding(vertical = 4.dp)
                    )
                    if (pending > 0) Text("$pending 筆待同步", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
    if (showMerchant) AlertDialog(onDismissRequest = { showMerchant = false }, title = { Text("目前商家") }, text = { Text(merchant.ifBlank { "商家營運中心" }) }, confirmButton = { TextButton({ showMerchant = false }) { Text("知道了") } })
}

@Composable
private fun OfflineBanner(lastSync: Long, detail: String, retry: () -> Unit) {
    val knownTime = remember(lastSync) {
        if (lastSync <= 0L) "" else java.time.Instant.ofEpochMilli(lastSync).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("MM/dd HH:mm"))
    }
    Surface(color = MaterialTheme.colorScheme.errorContainer) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("離線，顯示上次同步資料", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onErrorContainer)
                if (knownTime.isNotBlank()) Text("上次同步 $knownTime", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onErrorContainer)
            }
            TextButton(retry, Modifier.heightIn(min = 48.dp)) { Text("重試") }
        }
    }
}

@Composable
private fun DashboardScreen(o: JSONObject, r: JSONObject, store: LocalStore, network: OrderingState, navigate: (String) -> Unit) {
    val orders = o.array("orders")
    val settings = o.obj("settings")
    val k = r.obj("kpis")
    val printer = store.printer()
    val fontScale = LocalDensity.current.fontScale
    LazyColumn(
        Modifier.fillMaxSize().testTag("home-screen"),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            SectionTitle("營業狀態")
            ResponsiveRows(columns = if (fontScale >= 1.7f) 1 else 2) {
                StatusCard(if (settings.bool("accepting_orders")) "營業中" else "暫停接單", if (network == OrderingState.OFFLINE) "上次同步狀態" else "目前接單狀態", settings.bool("accepting_orders"))
                StatusCard(if (settings.bool("auto_accept_orders")) "自動接單" else "人工接單", "接單模式", true)
            }
        }
        item {
            SectionTitle("今日統計")
            ResponsiveRows(columns = if (fontScale >= 1.7f) 1 else 2) {
                MetricCard("今日營業額", money(k.int("revenue_minor")), Modifier.fillMaxWidth())
                MetricCard("訂單數", "${k.int("orders")} 筆", Modifier.fillMaxWidth())
                MetricCard("平均客單", money(k.int("average_order_minor")), Modifier.fillMaxWidth())
                MetricCard("待處理", "${k.int("pending")} 筆", Modifier.fillMaxWidth())
            }
        }
        item {
            SectionTitle("訂單處理狀態")
            ResponsiveRows(columns = if (fontScale >= 1.5f) 1 else 3) {
                QueueButton("新訂單", orders.countStatus("submitted"), Modifier.fillMaxWidth())
                QueueButton("製作中", orders.countStatuses("accepted", "preparing"), Modifier.fillMaxWidth())
                QueueButton("待出餐", orders.countStatus("ready"), Modifier.fillMaxWidth())
            }
        }
        item {
            SectionTitle("快捷操作")
            ResponsiveRows(columns = if (fontScale >= 1.7f) 1 else 2) {
                QuickButton("櫃台開單", Icons.Default.PointOfSale, "POS", navigate, Modifier.fillMaxWidth())
                QuickButton("桌號 QR", Icons.Default.QrCode2, "QR", navigate, Modifier.fillMaxWidth())
                QuickButton("菜單管理", Icons.Default.RestaurantMenu, "MENU", navigate, Modifier.fillMaxWidth())
                QuickButton("今日報表", Icons.Default.Assessment, "REPORT", navigate, Modifier.fillMaxWidth())
            }
        }
        item {
            SectionTitle("出單設備")
            ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Print, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(printer?.name ?: "XP-N160II 尚未設定", style = MaterialTheme.typography.titleMedium)
                        Text(if (printer == null) "印表機狀態未確認" else "${printer.host}:${printer.port} · Network 未確認", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(if (printer?.autoPrint == true) "自動出單 ON" else "自動出單 OFF", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        item { SectionTitle("最近訂單") }
        items(orders.take(5)) { OrderSummary(it, null) }
    }
}

@Composable private fun OrderCenter(o:JSONObject,api:MerchantApi,refresh:()->Unit){val all=o.array("orders");var filter by remember{mutableStateOf("全部")};var search by remember{mutableStateOf("")};var selected by remember{mutableStateOf<JSONObject?>(null)};val filters=listOf("全部","新訂單","製作中","待出餐","完成","取消");Column(Modifier.fillMaxSize().padding(14.dp).testTag("orders-screen")){Text("全通路訂單",fontSize=28.sp,fontWeight=FontWeight.Bold);LazyRow(horizontalArrangement=Arrangement.spacedBy(8.dp)){items(filters){FilterChip(filter==it,{filter=it},label={Text(it)})}};OutlinedTextField(search,{search=it},label={Text("搜尋訂單號、桌號、會員")},modifier=Modifier.fillMaxWidth());val visible=all.filter{q->(search.isBlank()||q.text("order_code").contains(search,true)||q.text("table_label").contains(search,true)||q.text("customer_name").contains(search,true))&&when(filter){"新訂單"->q.text("status")=="submitted";"製作中"->q.text("status") in listOf("accepted","preparing");"待出餐"->q.text("status")=="ready";"完成"->q.text("status") in listOf("served","completed");"取消"->q.text("status")=="cancelled";else->true}};LazyColumn(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(9.dp)){if(visible.isEmpty())item{EmptyState("目前沒有符合條件的訂單")};items(visible,key={it.text("order_code")}){OrderSummary(it){selected=it}}}};selected?.let{OrderDetail(it,api,{selected=null;refresh()},{selected=null})}}

@Composable private fun OrderSummary(o:JSONObject,onClick:(()->Unit)?){Card(Modifier.fillMaxWidth().then(if(onClick!=null)Modifier.clickable{onClick()} else Modifier)){Row(Modifier.padding(14.dp).fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column(Modifier.weight(1f)){Text(o.text("table_label").ifBlank{typeLabel(o.text("order_type"))},fontSize=25.sp,fontWeight=FontWeight.Black);Text("#${o.text("order_code").takeLast(8)} • ${o.text("source").ifBlank{"QR"}}");Text("${o.array("items").sumOf{it.int("quantity")}} 項餐點",color=MaterialTheme.colorScheme.onSurfaceVariant)};Column(horizontalAlignment=Alignment.End){Text(money(o.int("total_minor")),fontSize=20.sp,fontWeight=FontWeight.Bold);StatusBadge(statusLabel(o.text("status")),o.text("status")!="cancelled")}}}}

@Composable private fun OrderDetail(order:JSONObject,api:MerchantApi,onChanged:()->Unit,onClose:()->Unit){var cancel by remember{mutableStateOf(false)};var reason by remember{mutableStateOf("")};var paying by remember{mutableStateOf(false)};var received by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope();fun transition(status:String){busy=true;scope.launch{try{withContext(Dispatchers.IO){api.updateOrder(order.text("order_code"),status,if(status=="cancelled")reason else "","app-${UUID.randomUUID()}")};onChanged()}catch(e:Exception){error=e.message.orEmpty()}finally{busy=false}}};AlertDialog(onDismissRequest=onClose,title={Text("訂單 ${order.text("order_code")}")},text={LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){item{Text("${order.text("table_label").ifBlank{typeLabel(order.text("order_type"))}}・${order.text("source").ifBlank{"QR"}}");Text("會員：${order.text("customer_name").ifBlank{"散客"}}");Text("付款：${paymentLabel(order.text("payment_status"))}")};items(order.array("items")){i->Column{Text("${i.int("quantity")} × ${i.text("name")}",fontWeight=FontWeight.Bold);i.array("options").forEach{x->Text("　${x.text("group_name")}：${x.text("value_name")}")};if(i.text("note").isNotBlank())Text("※※ ${i.text("note")} ※※",color=MaterialTheme.colorScheme.error)}};item{HorizontalDivider();Text("總額 ${money(order.int("total_minor"))}",fontSize=22.sp,fontWeight=FontWeight.Black);if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)}}},confirmButton={Column{val next=nextStatus(order.text("status"));if(next!=null)Button({transition(next)},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text(statusAction(next))};if(order.text("payment_status")=="unpaid")OutlinedButton({paying=true},Modifier.fillMaxWidth()){Text("現金結帳")};if(order.text("status") !in listOf("completed","cancelled"))TextButton({cancel=true},Modifier.fillMaxWidth()){Text("取消訂單",color=MaterialTheme.colorScheme.error)}}},dismissButton={TextButton(onClose){Text("關閉")}});if(cancel)AlertDialog(onDismissRequest={cancel=false},title={Text("確認取消訂單")},text={OutlinedTextField(reason,{reason=it},label={Text("取消理由（必填）")})},confirmButton={Button({cancel=false;transition("cancelled")},enabled=reason.isNotBlank()){Text("確認取消")}},dismissButton={TextButton({cancel=false}){Text("返回")}});if(paying){val due=order.int("total_minor")/100;val got=received.toIntOrNull()?:0;AlertDialog(onDismissRequest={paying=false},title={Text("現金結帳")},text={Column{Text("應收 NT$ $due",fontSize=24.sp,fontWeight=FontWeight.Bold);OutlinedTextField(received,{received=it.filter(Char::isDigit)},label={Text("實收金額")});Text("找零 NT$ ${(got-due).coerceAtLeast(0)}")}},confirmButton={Button({scope.launch{busy=true;try{withContext(Dispatchers.IO){api.confirmPayment(order.text("order_code"),"cash","pay-${UUID.randomUUID()}")};paying=false;onChanged()}catch(e:Exception){error=e.message.orEmpty()}finally{busy=false}}},enabled=got>=due){Text("確認收款")}},dismissButton={TextButton({paying=false}){Text("取消")}})}}

@Composable
private fun PosScreen(o: JSONObject, api: MerchantApi, refresh: () -> Unit, network: OrderingState) {
    val products = o.array("items").filter { it.text("status") == "active" && it.bool("available", true) }
    val categories = o.array("categories")
    var category by remember { mutableStateOf(categories.firstOrNull()?.text("id").orEmpty()) }
    val cart = remember { mutableStateListOf<Pair<JSONObject, Int>>() }
    var type by remember { mutableStateOf("dine_in") }
    var table by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var cartOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val submit = { submitPos(api, cart, type, table, note, scope, { busy = it }, { message = it; refresh() }) }

    BoxWithConstraints(Modifier.fillMaxSize().testTag("pos-screen")) {
        val tablet = maxWidth >= 720.dp
        Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
            Text("櫃台開單", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 6.dp)) {
                items(listOf("dine_in" to "內用", "takeaway" to "外帶", "delivery" to "外送")) { (value, label) ->
                    FilterChip(type == value, { type = value }, label = { Text(label) })
                }
            }
            if (type == "dine_in") {
                OutlinedTextField(table, { table = it }, label = { Text("桌號") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp))
            }
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 8.dp)) {
                items(categories) { item -> FilterChip(category == item.text("id"), { category = item.text("id") }, label = { Text(item.text("name")) }) }
            }
            if (message.isNotBlank()) {
                Text(message, style = MaterialTheme.typography.bodyMedium, color = if (message.contains("成功")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 6.dp))
            }
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                ProductPicker(products.filter { category.isBlank() || it.text("category_id") == category }, cart, Modifier.weight(1f))
                if (tablet) {
                    CartPane(cart, note, { note = it }, submit, busy, Modifier.widthIn(min = 320.dp, max = 380.dp).fillMaxHeight(), network)
                }
            }
            if (!tablet) CartSummaryBar(cart, onOpen = { if (cart.isNotEmpty()) cartOpen = true })
        }
    }
    if (cartOpen) {
        ModalBottomSheet(onDismissRequest = { cartOpen = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            CartPane(cart, note, { note = it }, submit, busy, Modifier.fillMaxWidth().heightIn(max = 620.dp).navigationBarsPadding().imePadding(), network, sheet = true)
        }
    }
}

@Composable
private fun ProductPicker(products: List<JSONObject>, cart: MutableList<Pair<JSONObject, Int>>, modifier: Modifier) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 12.dp)) {
        if (products.isEmpty()) item { EmptyState("此分類尚無可販售商品") }
        items(products, key = { it.text("id") }) { product ->
            ElevatedCard(
                Modifier.fillMaxWidth().clickable {
                    val index = cart.indexOfFirst { it.first.text("id") == product.text("id") }
                    if (index < 0) cart.add(product to 1) else cart[index] = product to (cart[index].second + 1).coerceAtMost(20)
                },
                colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(product.text("name"), style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        Text(money(product.int("price_minor")), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                    }
                    Icon(Icons.Default.Add, contentDescription = "加入 ${product.text("name")}", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp))
                }
            }
        }
    }
}

@Composable
private fun CartSummaryBar(cart: List<Pair<JSONObject, Int>>, onOpen: () -> Unit) {
    val count = cart.sumOf { it.second }
    val total = cart.sumOf { it.first.int("price_minor") * it.second }
    Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 6.dp) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            val stacked = maxWidth < 340.dp || LocalDensity.current.fontScale >= 1.7f
            val summary: @Composable () -> Unit = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(10.dp))
                    Text(if (count == 0) "尚未選擇餐點" else "已選 $count 件 · ${money(total)}", style = MaterialTheme.typography.titleMedium)
                }
            }
            if (stacked) Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                summary()
                Button(onOpen, enabled = count > 0, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).testTag("open-cart")) { Text("查看購物車") }
            } else Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { summary() }
                Button(onOpen, enabled = count > 0, modifier = Modifier.heightIn(min = 48.dp).testTag("open-cart")) { Text("查看購物車") }
            }
        }
    }
}

@Composable
private fun CartPane(
    cart: MutableList<Pair<JSONObject, Int>>, note: String, setNote: (String) -> Unit, submit: () -> Unit,
    busy: Boolean, modifier: Modifier, network: OrderingState, sheet: Boolean = false
) {
    Surface(modifier, color = MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.large, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text("購物車", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(8.dp))
            if (cart.isEmpty()) {
                EmptyState("尚未選擇餐點")
                Spacer(Modifier.weight(1f))
            } else {
                LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    itemsIndexed(cart, key = { _, line -> line.first.text("id") }) { index, line ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(line.first.text("name"), style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
                                Text(money(line.first.int("price_minor") * line.second), color = MaterialTheme.colorScheme.primary)
                            }
                            FilledTonalIconButton({ if (line.second == 1) cart.removeAt(index) else cart[index] = line.first to line.second - 1 }, Modifier.size(48.dp)) { Text("−", fontSize = 22.sp) }
                            Text("${line.second}", modifier = Modifier.widthIn(min = 34.dp), textAlign = TextAlign.Center, fontWeight = FontWeight.Bold)
                            FilledTonalIconButton({ cart[index] = line.first to (line.second + 1).coerceAtMost(20) }, Modifier.size(48.dp)) { Text("＋", fontSize = 20.sp) }
                        }
                    }
                }
                OutlinedTextField(note, setNote, label = { Text("訂單備註") }, modifier = Modifier.fillMaxWidth(), minLines = 2, maxLines = 4)
            }
            Spacer(Modifier.height(10.dp))
            Text("總計 ${money(cart.sumOf { it.first.int("price_minor") * it.second })}", style = MaterialTheme.typography.headlineMedium)
            if (network == OrderingState.OFFLINE) Text("目前離線；送單後會標示待同步，不會顯示為已送達廚房。", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
            Button(submit, enabled = cart.isNotEmpty() && !busy, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text(if (busy) "送單中…" else "送單") }
        }
    }
}

private fun submitPos(api:MerchantApi,cart:List<Pair<JSONObject,Int>>,type:String,table:String,note:String,scope:kotlinx.coroutines.CoroutineScope,setBusy:(Boolean)->Unit,done:(String)->Unit){setBusy(true);scope.launch{try{val body=JSONObject().put("order_type",type).put("table_label",table).put("customer_note",note).put("items",JSONArray(cart.map{JSONObject().put("item_id",it.first.text("id")).put("quantity",it.second).put("option_value_ids",JSONArray())}));val result=withContext(Dispatchers.IO){api.counterOrder(body,"counter-${UUID.randomUUID()}")};done(if(result.optBoolean("queued"))"目前離線，訂單待同步，尚未送達廚房。" else "櫃台訂單建立成功") }catch(e:Exception){done(e.message.orEmpty())}finally{setBusy(false)}}}

@Composable
private fun MenuScreen(o: JSONObject, api: MerchantApi, refresh: () -> Unit, demoMode: Boolean) {
    val products = o.array("items")
    val categories = o.array("categories")
    var selectedCategory by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var showNew by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val visible = products.filter { selectedCategory.isBlank() || it.text("category_id") == selectedCategory }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp).testTag("menu-screen")) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 6.dp)) {
            val narrow = maxWidth < 350.dp || LocalDensity.current.fontScale >= 1.7f
            if (narrow) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                MenuHeaderTitle(demoMode)
                Button({ showNew = true }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(6.dp)); Text("新增商品") }
            } else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { MenuHeaderTitle(demoMode) }
                Button({ showNew = true }, Modifier.heightIn(min = 48.dp)) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(6.dp)); Text("新增商品") }
            }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(vertical = 6.dp)) {
            item { FilterChip(selectedCategory.isBlank(), { selectedCategory = "" }, label = { Text("全部") }) }
            items(categories, key = { it.text("id") }) { category ->
                FilterChip(selectedCategory == category.text("id"), { selectedCategory = category.text("id") }, label = { Text(category.text("name")) })
            }
        }
        if (message.isNotBlank()) Text(message, color = if (message.contains("已")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        Text("共 ${visible.size} 項商品", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 6.dp))
        LazyColumn(Modifier.weight(1f).testTag("menu-product-list"), verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
            if (visible.isEmpty()) item { EmptyState("此分類尚無商品") }
            items(visible, key = { it.text("id") }) { product ->
                MenuProductCard(product) {
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { api.updateMenuItem(product.text("id"), JSONObject().put("status", if (product.text("status") == "sold_out") "active" else "sold_out")) }
                            message = if (product.text("status") == "sold_out") "已恢復販售" else "已立即標記售完"
                            refresh()
                        } catch (error: Exception) { message = error.message.orEmpty() }
                    }
                }
            }
        }
    }
    if (showNew) NewProductDialog(categories, api, { showNew = false; refresh() }, { showNew = false })
}

@Composable
private fun MenuHeaderTitle(demoMode: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("菜單管理", style = MaterialTheme.typography.headlineLarge)
        if (demoMode) {
            Spacer(Modifier.width(8.dp))
            Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.small) {
                Text("示範模式", Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

@Composable
private fun MenuProductCard(product: JSONObject, toggleSoldOut: () -> Unit) {
    val soldOut = product.text("status") == "sold_out"
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(14.dp)) {
            val stacked = maxWidth < 330.dp || LocalDensity.current.fontScale >= 1.5f
            val detail: @Composable (Modifier) -> Unit = { modifier -> Column(modifier) {
                Text(product.text("name"), style = MaterialTheme.typography.titleMedium, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text(money(product.int("price_minor")), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusBadge(if (soldOut) "售完" else "販售中", !soldOut)
                    if (product.bool("inventory_exists")) Text("庫存 ${product.int("stock_on_hand")}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } }
            if (stacked) Column {
                detail(Modifier.fillMaxWidth())
                TextButton(toggleSoldOut, Modifier.align(Alignment.End).heightIn(min = 48.dp)) { Text(if (soldOut) "恢復販售" else "標記售完") }
            } else Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                detail(Modifier.weight(1f))
                TextButton(toggleSoldOut, Modifier.heightIn(min = 48.dp)) { Text(if (soldOut) "恢復販售" else "標記售完") }
            }
        }
    }
}

@Composable private fun NewProductDialog(categories:List<JSONObject>,api:MerchantApi,done:()->Unit,cancel:()->Unit){var name by remember{mutableStateOf("")};var price by remember{mutableStateOf("")};var category by remember{mutableStateOf(categories.firstOrNull()?.text("id").orEmpty())};var expanded by remember{mutableStateOf(false)};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope();AlertDialog(onDismissRequest=cancel,title={Text("新增商品")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){OutlinedTextField(name,{name=it},label={Text("商品名稱")});OutlinedTextField(price,{price=it.filter(Char::isDigit)},label={Text("售價")});Box{OutlinedButton({expanded=true}){Text(categories.firstOrNull{it.text("id")==category}?.text("name")?:"選分類")};DropdownMenu(expanded,{expanded=false}){categories.forEach{c->DropdownMenuItem({Text(c.text("name"))},{category=c.text("id");expanded=false})}}};if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)}},confirmButton={Button({scope.launch{try{withContext(Dispatchers.IO){api.createMenuItem(JSONObject().put("category_id",category).put("name",name).put("price_minor",(price.toIntOrNull()?:0)*100).put("status","active"))};done()}catch(e:Exception){error=e.message.orEmpty()}}},enabled=name.isNotBlank()&&category.isNotBlank()&&(price.toIntOrNull()?:0)>0){Text("建立")}},dismissButton={TextButton(cancel){Text("取消")}})}

@Composable
private fun MoreHost(page: MorePage, setPage: (MorePage) -> Unit, o: JSONObject, d: JSONObject, r: JSONObject, reportsState: ReportsState, store: LocalStore, api: MerchantApi, refresh: () -> Unit, onLogout: () -> Unit) {
    if (page != MorePage.ROOT) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton({ setPage(MorePage.ROOT) }, Modifier.size(48.dp)) { Icon(Icons.Default.ArrowBack, contentDescription = "返回更多") }
                Text(page.title, style = MaterialTheme.typography.headlineMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Box(Modifier.weight(1f)) {
                when (page) {
                    MorePage.TABLES -> TablesScreen(o, api, refresh)
                    MorePage.KDS -> KdsScreen(o, api, refresh)
                    MorePage.MEMBERS -> MembersScreen(api, store)
                    MorePage.REPORTS -> ReportsScreen(r, api, reportsState, showTitle = false)
                    MorePage.STORE -> StoreScreen(o, api, refresh)
                    MorePage.PRINTER -> PrinterScreen(store, api)
                    MorePage.PRINT_HISTORY -> PrintHistoryScreen(api)
                    MorePage.PROMOTIONS -> PromotionsScreen(api)
                    MorePage.CALLING -> CallingScreen(o)
                    MorePage.STAFF -> StaffScreen(api)
                    MorePage.INTEGRATIONS -> IntegrationsScreen(api)
                    MorePage.ABOUT -> AboutScreen(store, onLogout)
                    else -> Unit
                }
            }
        }
    } else LazyColumn(Modifier.fillMaxSize().padding(16.dp).testTag("more-screen"), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("營運工具", style = MaterialTheme.typography.headlineLarge) }
        items(MorePage.entries.filter { it != MorePage.ROOT }.chunked(2)) { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { item ->
                    ElevatedCard(Modifier.weight(1f).heightIn(min = 88.dp).clickable { setPage(item) }, colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Box(Modifier.fillMaxSize().padding(14.dp), contentAlignment = Alignment.CenterStart) { Text(item.title, style = MaterialTheme.typography.titleMedium) }
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable private fun TablesScreen(o:JSONObject,api:MerchantApi,refresh:()->Unit){val qrs=o.array("qrs");val sessions=o.array("dining_sessions");var table by remember{mutableStateOf("")};var shown by remember{mutableStateOf<JSONObject?>(null)};var error by remember{mutableStateOf("")};val scope=rememberCoroutineScope();LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){item{Text("桌位與安全 QR",fontSize=28.sp,fontWeight=FontWeight.Bold);Text("沿用正式不可猜測 QR code，不以桌號當 token。")};item{Row(verticalAlignment=Alignment.CenterVertically){OutlinedTextField(table,{table=it.uppercase()},label={Text("新桌號，例如 A1")},modifier=Modifier.weight(1f));Button({scope.launch{try{withContext(Dispatchers.IO){api.createQr("桌號 $table",table)};table="";refresh()}catch(e:Exception){error=e.message.orEmpty()}}},enabled=table.isNotBlank()){Text("建立 QR")}}};items(qrs){q->val active=sessions.firstOrNull{it.text("qr_code")==q.text("code")&&it.text("status")=="open"};Card(Modifier.fillMaxWidth().clickable{shown=q}){Row(Modifier.padding(14.dp).fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Column{Text(q.text("table_label").ifBlank{q.text("label")},fontSize=23.sp,fontWeight=FontWeight.Black);Text(if(active==null)"空桌" else "用餐中・${money(active.int("total_minor"))}")};Text("查看 QR")}}};if(error.isNotBlank())item{Text(error,color=MaterialTheme.colorScheme.error)}};shown?.let{QrDialog(it){shown=null}}}

@Composable private fun QrDialog(q:JSONObject,onClose:()->Unit){val context=LocalContext.current;val tableQr=q.text("table_label").isNotBlank();val liffUrl=q.text("liff_ordering_url");val url=if(tableQr)liffUrl else liffUrl.ifBlank{q.text("ordering_url")};val bitmap=remember(url){if(url.startsWith("https://liff.line.me/"))qrBitmap(url)else if(!tableQr&&url.startsWith("https://"))qrBitmap(url)else null};AlertDialog(onDismissRequest=onClose,title={Text(q.text("table_label").ifBlank{"點餐 QR"})},text={Column(horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(10.dp)){if(bitmap!=null){Image(bitmap.asImageBitmap(),null,Modifier.size(240.dp));Text(url,fontSize=12.sp)}else{ErrorState(if(tableQr)"正式桌號 QR 僅允許 LINE LIFF，請先完成 LIFF ID 與 Channel 設定。" else "商家品牌點餐連結尚未載入，請關閉後重新整理。")};Button({context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply{type="text/plain";putExtra(Intent.EXTRA_TEXT,url)},"分享安全點餐連結"))},enabled=bitmap!=null){Text("分享 QR 連結")}}},confirmButton={TextButton(onClose){Text("完成")}})}

@Composable private fun KdsScreen(o:JSONObject,api:MerchantApi,refresh:()->Unit){val scope=rememberCoroutineScope();val columns=listOf("submitted" to "新單","preparing" to "製作中","ready" to "待出餐");BoxWithConstraints(Modifier.fillMaxSize().padding(12.dp)){val horizontal=maxWidth>=720.dp;val content:@Composable (Pair<String,String>)->Unit={c->Column(Modifier.then(if(horizontal)Modifier.width((maxWidth-32.dp)/3)else Modifier.fillMaxWidth()).background(MaterialTheme.colorScheme.surfaceVariant).padding(10.dp)){Text(c.second,fontSize=23.sp,fontWeight=FontWeight.Black);o.array("orders").filter{if(c.first=="preparing")it.text("status") in listOf("accepted","preparing")else it.text("status")==c.first}.forEach{order->Card(Modifier.fillMaxWidth().padding(vertical=5.dp)){Column(Modifier.padding(12.dp)){Text(order.text("table_label").ifBlank{"外帶"},fontSize=30.sp,fontWeight=FontWeight.Black);Text("#${order.text("order_code").takeLast(6)}");order.array("items").forEach{Text("${it.int("quantity")}× ${it.text("name")}",fontSize=19.sp,fontWeight=FontWeight.Bold)};nextStatus(order.text("status"))?.let{next->Button({scope.launch{runCatching{withContext(Dispatchers.IO){api.updateOrder(order.text("order_code"),next,key="kds-${UUID.randomUUID()}")};refresh()}}},Modifier.fillMaxWidth()){Text(statusAction(next))}}}}}}};if(horizontal)Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){for(c in columns)content(c)}else LazyColumn(verticalArrangement=Arrangement.spacedBy(8.dp)){items(columns){content(it)}}}}

@Composable private fun MembersScreen(api:MerchantApi,store:LocalStore){var payload by remember{mutableStateOf(store.cached("members")?.jsonOrNull() ?: if(store.demoMode()) demoMembers() else JSONObject().put("members",JSONArray()))};var query by remember{mutableStateOf("")};var loading by remember{mutableStateOf(true)};var error by remember{mutableStateOf("")};LaunchedEffect(Unit){try{if(!store.demoMode())payload=withContext(Dispatchers.IO){api.members()}}catch(e:Exception){error=e.message.orEmpty()}finally{loading=false}};Column(Modifier.fillMaxSize().padding(16.dp)){Text("會員中心",fontSize=28.sp,fontWeight=FontWeight.Bold);OutlinedTextField(query,{query=it},label={Text("搜尋姓名、手機、會員編號")},modifier=Modifier.fillMaxWidth());if(loading)LinearProgressIndicator(Modifier.fillMaxWidth());if(error.isNotBlank())Text("會員資料暫時無法更新") ;LazyColumn{items(payload.array("members").filter{query.isBlank()||it.text("display_name").contains(query,true)||it.text("name").contains(query,true)||it.text("phone_masked").contains(query)||it.text("membership_no").contains(query,true)}){m->ListItem(headlineContent={Text(m.text("display_name").ifBlank{m.text("name").ifBlank{"未命名會員"}})},supportingContent={Text("${m.text("phone_masked").ifBlank{m.text("phone")}}・消費 ${m.int("order_count")} 次")})}}}}

@Composable
private fun ReportsScreen(initial: JSONObject, api: MerchantApi, initialState: ReportsState, showTitle: Boolean = true) {
    var report by remember { mutableStateOf(initial) }
    var period by remember { mutableStateOf("today") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var freshness by remember { mutableStateOf(initialState) }
    val scope = rememberCoroutineScope()
    val fontScale = LocalDensity.current.fontScale
    val periods = listOf("today" to "今天", "yesterday" to "昨天", "7d" to "7 日", "30d" to "30 日")
    val k = report.obj("kpis")
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp).testTag("reports-screen"),
        contentPadding = PaddingValues(top = 12.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (showTitle) item { Text("營運報表", style = MaterialTheme.typography.headlineLarge) }
        item {
            ResponsiveRows(columns = if (fontScale >= 1.7f) 2 else 4, gap = 8.dp) {
                periods.forEach { (value, label) ->
                    FilterChip(period == value, {
                        period = value; loading = true; error = ""
                        scope.launch {
                            try { report = withContext(Dispatchers.IO) { api.reports(value) }; freshness = ReportsState.FRESH }
                            catch (cause: Exception) { error = cause.message.orEmpty(); freshness = if (report.has("kpis")) ReportsState.STALE else ReportsState.ERROR }
                            finally { loading = false }
                        }
                    }, label = { Text(label) }, modifier = Modifier.fillMaxWidth())
                }
            }
        }
        if (loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        if (error.isNotBlank()) item { ErrorState("報表載入失敗，請稍後重試") }
        if (freshness == ReportsState.STALE) item { Text("報表暫時無法更新，顯示上次同步資料", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (freshness == ReportsState.ERROR && error.isBlank()) item { ErrorState("報表資料暫時無法取得") }
        item {
            ResponsiveRows(columns = if (fontScale >= 1.7f) 1 else 2) {
                MetricCard("營業額", money(k.int("revenue_minor")), Modifier.fillMaxWidth())
                MetricCard("訂單數", "${k.int("orders")} 筆", Modifier.fillMaxWidth())
                MetricCard("平均客單", money(k.int("average_order_minor")), Modifier.fillMaxWidth())
                MetricCard("新會員", "${k.int("new_members")} 位", Modifier.fillMaxWidth())
            }
        }
        item { SectionTitle("熱銷商品") }
        val products = report.array("products")
        if (products.isEmpty()) item { EmptyState("此期間尚無資料") }
        itemsIndexed(products, key = { index, product -> product.text("id").ifBlank { "$index-${product.text("name")}" } }) { index, product ->
            ReportProductRow(index + 1, product)
        }
    }
}

@Composable
private fun ReportProductRow(rank: Int, product: JSONObject) {
    ElevatedCard(Modifier.fillMaxWidth(), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        BoxWithConstraints(Modifier.fillMaxWidth().padding(14.dp)) {
            val narrow = maxWidth < 330.dp || LocalDensity.current.fontScale >= 1.5f
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.small) {
                    Text("$rank", Modifier.padding(horizontal = 10.dp, vertical = 6.dp), fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(12.dp))
                if (narrow) Column(Modifier.weight(1f)) {
                    Text(product.text("name"), style = MaterialTheme.typography.titleMedium)
                    Text("銷售 ${product.int("quantity")} 份", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(money(product.int("revenue_minor")), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                } else {
                    Text(product.text("name"), style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f), maxLines = 3, overflow = TextOverflow.Ellipsis)
                    Column(horizontalAlignment = Alignment.End) {
                        Text("${product.int("quantity")} 份", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(money(product.int("revenue_minor")), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable private fun StoreScreen(o:JSONObject,api:MerchantApi,refresh:()->Unit){val s=o.obj("settings");var accepting by remember{mutableStateOf(s.bool("accepting_orders"))};var auto by remember{mutableStateOf(s.bool("auto_accept_orders"))};var dine by remember{mutableStateOf(s.bool("dine_in_enabled",true))};var take by remember{mutableStateOf(s.bool("takeaway_enabled",true))};var prep by remember{mutableStateOf(s.int("estimated_prep_minutes").coerceAtLeast(15).toString())};var message by remember{mutableStateOf("")};val scope=rememberCoroutineScope();LazyColumn(Modifier.fillMaxSize().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){item{Text("店舖設定",fontSize=28.sp,fontWeight=FontWeight.Bold)};item{SettingSwitch("營業中 / 接受新訂單",accepting){accepting=it}};item{SettingSwitch("自動接單",auto){auto=it}};item{SettingSwitch("內用",dine){dine=it}};item{SettingSwitch("外帶",take){take=it}};item{OutlinedTextField(prep,{prep=it.filter(Char::isDigit)},label={Text("預估備餐分鐘")})};item{Button({scope.launch{try{withContext(Dispatchers.IO){api.saveOrderingSettings(JSONObject().put("accepting_orders",accepting).put("auto_accept_orders",auto).put("dine_in_enabled",dine).put("takeaway_enabled",take).put("estimated_prep_minutes",prep.toIntOrNull()?:15))};message="設定已儲存";refresh()}catch(e:Exception){message=e.message.orEmpty()}}},Modifier.fillMaxWidth().heightIn(min=50.dp)){Text("儲存")};if(message.isNotBlank())Text(message)}}}

@Composable
private fun PrinterScreen(store: LocalStore, api: MerchantApi) {
    val current = store.printer()
    var name by remember { mutableStateOf(current?.name ?: "百工牛肉麵出單機") }
    var host by remember { mutableStateOf(current?.host ?: "") }
    var port by remember { mutableStateOf((current?.port ?: 9100).toString()) }
    var auto by remember { mutableStateOf(current?.autoPrint ?: false) }
    var copies by remember { mutableIntStateOf(current?.copies ?: 1) }
    var message by remember { mutableStateOf("") }
    var testReceiptWritten by remember { mutableStateOf(false) }
    var physicalTestConfirmed by remember { mutableStateOf(current?.autoPrint == true) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val resetTestGate = {
        testReceiptWritten = false
        physicalTestConfirmed = false
        if (current?.autoPrint != true) auto = false
    }
    val config = {
        PrinterConfig(
            current?.id ?: "local-primary",
            name,
            "Xprinter XP-N160II",
            host,
            port.toIntOrNull() ?: 9100,
            80,
            true,
            auto,
            copies,
        )
    }
    LazyColumn(
        Modifier.fillMaxSize().padding(16.dp).testTag("printer-settings"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text("印表機", fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Text("Xprinter XP-N160II・LAN・80mm")
        }
        item {
            OutlinedTextField(name, { name = it }, label = { Text("名稱") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(host, { host = it; resetTestGate() }, label = { Text("IP Address") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(port, { port = it.filter(Char::isDigit); resetTestGate() }, label = { Text("Port（可修改）") }, modifier = Modifier.fillMaxWidth())
            Text(
                "建議於路由器設定 DHCP 保留位址，避免印表機重新取得不同 IP。",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item {
            SettingSwitch("自動出單", auto) { requested ->
                if (!requested) auto = false
                else if (physicalTestConfirmed) auto = true
                else message = "請先完成測試列印，並確認實體紙本的繁體中文、80mm 排版與切紙。"
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("份數 $copies")
                Slider(copies.toFloat(), { copies = it.toInt().coerceIn(1, 5) }, valueRange = 1f..5f, steps = 3)
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton({
                    scope.launch {
                        message = runCatching {
                            withContext(Dispatchers.IO) { LanEscPosPrinter().test(config()) }
                            "TCP ${config().host}:${config().port} 連線成功"
                        }.getOrElse { "無法連線：${it.message}" }
                    }
                }) { Text("測試連線") }
                OutlinedButton({
                    scope.launch {
                        message = runCatching {
                            withContext(Dispatchers.IO) {
                                LanEscPosPrinter().print(config(), EscPosRenderer().testReceipt())
                            }
                            testReceiptWritten = true
                            physicalTestConfirmed = false
                            "測試單已傳送，請確認實體紙本與切紙。"
                        }.getOrElse {
                            testReceiptWritten = false
                            physicalTestConfirmed = false
                            "測試列印失敗：${it.message}"
                        }
                    }
                }) { Text("測試列印") }
            }
            if (testReceiptWritten) {
                OutlinedButton({
                    physicalTestConfirmed = true
                    message = "已確認實體測試單；現在可以開啟自動出單。"
                }, Modifier.fillMaxWidth()) { Text("確認測試單已正確吐紙與切紙") }
            }
            Button({
                scope.launch {
                    try {
                        if (auto && !physicalTestConfirmed) {
                            message = "尚未確認實體測試單，無法開啟自動出單。"
                            return@launch
                        }
                        val saved = withContext(Dispatchers.IO) { api.savePrinter(config()) }
                        store.savePrinter(saved)
                        if (saved.autoPrint) PrintService.start(context)
                        message = "已儲存"
                    } catch (e: Exception) {
                        message = e.message.orEmpty()
                    }
                }
            }, Modifier.fillMaxWidth()) { Text("儲存") }
            Text(message)
        }
    }
}

@Composable private fun PromotionsScreen(api:MerchantApi){var payload by remember{mutableStateOf(JSONObject())};var error by remember{mutableStateOf("")};LaunchedEffect(Unit){try{payload=withContext(Dispatchers.IO){api.promotions()}}catch(e:Exception){error=e.message.orEmpty()}};LazyColumn(Modifier.fillMaxSize().padding(16.dp)){item{Text("優惠與折扣",fontSize=28.sp,fontWeight=FontWeight.Bold);Text("價格由伺服器重新計算，App 不自行決定折扣。")};items(payload.array("campaigns")){p->ListItem(headlineContent={Text(p.text("name"))},supportingContent={Text(p.text("status"))})};item{Text("滿件折、百分比、買 N 送 M 等進階規則尚未啟用。",color=MaterialTheme.colorScheme.onSurfaceVariant);if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error)}}}

@Composable private fun CallingScreen(o:JSONObject){var called by remember{mutableStateOf("")};LazyColumn(Modifier.fillMaxSize().padding(16.dp)){item{Text("叫號",fontSize=28.sp,fontWeight=FontWeight.Bold);Text("READY 訂單可在店內重複叫號；LINE 與 TV 看板為後續整合。")};items(o.array("orders").filter{it.text("status")=="ready"}){order->ListItem(headlineContent={Text(order.text("pickup_number").ifBlank{order.text("table_label")},fontSize=30.sp,fontWeight=FontWeight.Black)},supportingContent={Text("#${order.text("order_code")}")},trailingContent={Button({called=order.text("pickup_number").ifBlank{order.text("table_label")}}){Text("叫號")}})};if(called.isNotBlank())item{Text("$called 餐點完成",fontSize=30.sp,fontWeight=FontWeight.Black,color=MaterialTheme.colorScheme.primary)}}}

@Composable private fun StaffScreen(api:MerchantApi){var payload by remember{mutableStateOf(JSONObject())};LaunchedEffect(Unit){runCatching{payload=withContext(Dispatchers.IO){api.staff()}}};LazyColumn(Modifier.fillMaxSize().padding(16.dp)){item{Text("員工權限",fontSize=28.sp,fontWeight=FontWeight.Bold)};items(payload.array("staff")){s->ListItem(headlineContent={Text(s.text("name"))},supportingContent={Text(s.text("role").uppercase())})};item{Text("權限沿用既有 OWNER / MANAGER / CASHIER / KITCHEN / STAFF；所有 API 仍由後端驗證。")}}}

@Composable private fun IntegrationsScreen(api:MerchantApi){var p by remember{mutableStateOf(JSONObject())};LaunchedEffect(Unit){runCatching{p=withContext(Dispatchers.IO){api.integrations()}}};val cards=listOf("LINE OA" to if(p.obj("line").bool("connected"))"已連線" else "需要設定","XP-N160II" to if(p.array("printers").isNotEmpty())"已連線" else "需要設定","Google" to "尚未支援","LINE Pay / 信用卡" to "未設定","電子發票" to "尚未啟用","Uber Eats" to "尚未連線","foodpanda" to "尚未連線","第三方物流" to "尚未支援");LazyColumn(Modifier.fillMaxSize().padding(16.dp)){item{Text("整合服務",fontSize=28.sp,fontWeight=FontWeight.Bold)};items(cards){(name,status)->ListItem(headlineContent={Text(name,fontWeight=FontWeight.Bold)},trailingContent={StatusBadge(status,status=="已連線")})};item{Text("外送平台不使用爬蟲或逆向工程；取得正式授權與 credentials 後才會啟用。",color=MaterialTheme.colorScheme.onSurfaceVariant)}}}

@Composable private fun AboutScreen(store:LocalStore,onLogout:()->Unit){Column(Modifier.fillMaxSize().padding(20.dp).testTag("history-screen"),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("點餐靈",fontSize=38.sp,fontWeight=FontWeight.Black);Text("創百業智慧餐飲管理系統",fontSize=18.sp);Text("版本 ${BuildConfig.VERSION_NAME}");Text("正式登入只顯示目前商家的雲端資料。",color=MaterialTheme.colorScheme.onSurfaceVariant);Button(onLogout,Modifier.fillMaxWidth()){Text("登出")}}}

@Composable private fun SettingSwitch(label:String,checked:Boolean,onChange:(Boolean)->Unit){Row(Modifier.fillMaxWidth().heightIn(min=52.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text(label,fontWeight=FontWeight.SemiBold,modifier=Modifier.weight(1f));Switch(checked,onChange)}}

@Composable
private fun ResponsiveRows(columns: Int, gap: androidx.compose.ui.unit.Dp = 10.dp, content: @Composable () -> Unit) {
    val safeColumns = columns.coerceAtLeast(1)
    Layout(content = content) { measurables, constraints ->
        if (measurables.isEmpty()) return@Layout layout(constraints.minWidth, 0) {}
        val gapPx = gap.roundToPx()
        val cellWidth = ((constraints.maxWidth - gapPx * (safeColumns - 1)) / safeColumns).coerceAtLeast(0)
        val placeables = measurables.map { it.measure(constraints.copy(minWidth = cellWidth, maxWidth = cellWidth, minHeight = 0)) }
        val rowHeights = placeables.chunked(safeColumns).map { row -> row.maxOf { it.height } }
        val height = rowHeights.sum() + gapPx * (rowHeights.size - 1).coerceAtLeast(0)
        layout(constraints.maxWidth, height) {
            var y = 0
            placeables.chunked(safeColumns).forEachIndexed { rowIndex, row ->
                row.forEachIndexed { columnIndex, item -> item.placeRelative(columnIndex * (cellWidth + gapPx), y) }
                y += rowHeights[rowIndex] + gapPx
            }
        }
    }
}

@Composable private fun SectionTitle(text: String) { Text(text, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(bottom = 8.dp)) }

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    ElevatedCard(modifier.heightIn(min = 104.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, fontSize = 27.sp, lineHeight = 34.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun StatusCard(title: String, supporting: String, positive: Boolean) {
    Surface(Modifier.fillMaxWidth().heightIn(min = 72.dp), color = if (positive) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).background(if (positive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error, shape = MaterialTheme.shapes.small))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(supporting, style = MaterialTheme.typography.labelMedium) }
        }
    }
}

@Composable
private fun QueueButton(label: String, count: Int, modifier: Modifier) {
    ElevatedCard(modifier.heightIn(min = 86.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("$count", fontSize = 27.sp, fontWeight = FontWeight.Black)
            Text(label, style = MaterialTheme.typography.bodyMedium, maxLines = 2, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun QuickButton(label: String, icon: ImageVector, key: String, go: (String) -> Unit, modifier: Modifier) {
    OutlinedButton({ go(key) }, modifier.heightIn(min = 58.dp), shape = MaterialTheme.shapes.medium, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Icon(icon, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text(label, maxLines = 2, textAlign = TextAlign.Center)
    }
}

@Composable private fun EmptyState(text:String){Box(Modifier.fillMaxWidth().padding(24.dp),contentAlignment=Alignment.Center){Text(text,color=MaterialTheme.colorScheme.onSurfaceVariant,textAlign=TextAlign.Center)}}
@Composable private fun ErrorState(text:String){Surface(color=MaterialTheme.colorScheme.errorContainer,shape=MaterialTheme.shapes.medium){Text(text,Modifier.fillMaxWidth().padding(14.dp),color=MaterialTheme.colorScheme.onErrorContainer)}}
@Composable private fun StatusBadge(text:String,positive:Boolean){Surface(color=if(positive)MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.errorContainer,shape=MaterialTheme.shapes.small){Text(text,Modifier.padding(horizontal=10.dp,vertical=6.dp),style=MaterialTheme.typography.labelMedium,color=if(positive)MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onErrorContainer)}}

@Composable private fun PrintHistoryScreen(api:MerchantApi){
    var jobs by remember { mutableStateOf<List<PrintJob>>(emptyList()) }
    var selected by remember { mutableStateOf<PrintJob?>(null) }
    var reason by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    fun load() { scope.launch { try { jobs = withContext(Dispatchers.IO) { api.history() } } catch (e:Exception) { message=e.message.orEmpty() } } }
    LaunchedEffect(Unit) { load() }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp).testTag("print-history-screen")) {
        item { Text("列印紀錄",fontSize=28.sp,fontWeight=FontWeight.Bold); Text("疑義列印不會自動重送，請先確認紙本。") }
        items(jobs,key={it.id}) { job -> ListItem(headlineContent={Text("#${job.orderCode}")},supportingContent={Text("${job.status}・嘗試 ${job.attemptCount} 次${if(job.lastError.isBlank())"" else "・${job.lastError}"}")},trailingContent={OutlinedButton({selected=job}){Text("補印")}}) }
        if(jobs.isEmpty()) item { EmptyState(if(message.isBlank())"目前沒有列印紀錄" else message) }
    }
    selected?.let { job -> AlertDialog(onDismissRequest={selected=null},title={Text("確定重新列印 #${job.orderCode}？")},text={OutlinedTextField(reason,{reason=it},label={Text("補印原因（必填）")})},confirmButton={Button({scope.launch{try{withContext(Dispatchers.IO){api.reprint(job.id,reason,"reprint-${UUID.randomUUID()}")};message="已建立標註【補印】的列印任務";selected=null;reason="";load()}catch(e:Exception){message=e.message.orEmpty()}}},enabled=reason.isNotBlank()){Text("確認補印")}},dismissButton={TextButton({selected=null}){Text("取消")}}) }
}

private fun JSONObject.text(key:String)=optString(key,"")
private fun JSONObject.int(key:String)=optInt(key,0)
private fun JSONObject.bool(key:String,default:Boolean=false)=if(has(key)&&!isNull(key))optBoolean(key,default)else default
private fun JSONObject.obj(key:String)=optJSONObject(key)?:JSONObject()
private fun JSONObject.array(key:String)=optJSONArray(key).toObjects()
private fun JSONArray?.toObjects(): List<JSONObject> = buildList{for(i in 0 until (this@toObjects?.length()?:0))add(this@toObjects!!.optJSONObject(i)?:JSONObject())}
private fun String.jsonOrNull()=runCatching{JSONObject(this)}.getOrNull()
private fun List<JSONObject>.countStatus(status:String)=count{it.text("status")==status}
private fun List<JSONObject>.countStatuses(vararg status:String)=count{it.text("status") in status}
private fun money(minor:Int)="NT$ %,d".format(minor/100)
private fun statusLabel(s:String)=when(s){"submitted"->"待接單";"accepted"->"已接單";"preparing"->"製作中";"ready"->"待出餐";"served"->"已出餐";"completed"->"完成";"cancelled"->"取消";"sold_out"->"售完";"active"->"販售中";else->s.ifBlank{"未知"}}
private fun typeLabel(s:String)=when(s){"dine_in"->"內用";"takeaway"->"外帶";"delivery"->"外送";else->"訂單"}
private fun paymentLabel(s:String)=when(s){"paid"->"已付款";"unpaid"->"未付款";"refunded"->"已退款";else->s}
private fun nextStatus(s:String)=when(s){"submitted"->"accepted";"accepted"->"preparing";"preparing"->"ready";"ready"->"served";"served"->"completed";else->null}
private fun statusAction(s:String)=when(s){"accepted"->"接單";"preparing"->"開始製作";"ready"->"餐點完成";"served"->"待取餐 / 出餐";"completed"->"完成";else->s}
private fun qrBitmap(value:String):Bitmap?=runCatching{val matrix=MultiFormatWriter().encode(value,BarcodeFormat.QR_CODE,600,600);Bitmap.createBitmap(600,600,Bitmap.Config.RGB_565).apply{for(y in 0 until 600)for(x in 0 until 600)setPixel(x,y,if(matrix[x,y])android.graphics.Color.BLACK else android.graphics.Color.WHITE)}}.getOrNull()

private fun emptyOverview() = JSONObject()
    .put("merchant_id", "")
    .put("settings", JSONObject())
    .put("categories", JSONArray())
    .put("items", JSONArray())
    .put("orders", JSONArray())
    .put("qrs", JSONArray())
    .put("dining_sessions", JSONArray())
    .put("option_groups", JSONArray())

private fun JSONObject.isRecent(): Boolean {
    val value = text("created_at")
    val created = runCatching {
        if (value.endsWith("Z") || value.contains("+")) Instant.parse(value)
        else LocalDateTime.parse(value.replace(' ', 'T')).toInstant(ZoneOffset.UTC)
    }.getOrNull() ?: return false
    return Duration.between(created, Instant.now()).abs() <= Duration.ofHours(2)
}

private fun notifyNewOrder(context: Context, store: LocalStore, order: JSONObject) {
    val orderCode = order.text("order_code")
    if (orderCode.isBlank() || !store.markNotified(orderCode)) return
    val channelId = "baiye_new_orders_v1"
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        manager.createNotificationChannel(NotificationChannel(channelId, "點餐靈新訂單", NotificationManager.IMPORTANCE_HIGH))
    }
    val intent = Intent(context, MainActivity::class.java).putExtra("order_code", orderCode)
    val pendingIntent = PendingIntent.getActivity(context, orderCode.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val table = order.text("table_label").ifBlank { typeLabel(order.text("order_type")) }
    val notification = androidx.core.app.NotificationCompat.Builder(context, channelId)
        .setSmallIcon(android.R.drawable.stat_notify_more)
        .setContentTitle("$table 新訂單 ${money(order.int("total_minor"))}")
        .setContentText("訂單 $orderCode")
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
        .build()
    manager.notify(orderCode.hashCode(), notification)
}

private fun demoOverview():JSONObject{val cats=JSONArray().put(JSONObject().put("id","cat-noodle").put("name","麵食")).put(JSONObject().put("id","cat-side").put("name","小菜"));val products=JSONArray();repeat(20){i->products.put(JSONObject().put("id","item-$i").put("category_id",if(i<12)"cat-noodle" else "cat-side").put("name",if(i<12)"招牌牛肉麵 ${i+1}" else "精選小菜 ${i-11}").put("price_minor",(100+i*10)*100).put("status",if(i==4)"sold_out" else "active").put("available",i!=4))};val orders=JSONArray();repeat(10){i->orders.put(JSONObject().put("order_code","A1-%04d".format(88-i)).put("table_label","A${i%5+1}").put("source",listOf("QR","LINE","WEB","COUNTER")[i%4]).put("order_type",if(i%3==0)"takeaway" else "dine_in").put("status",listOf("submitted","accepted","preparing","ready","completed")[i%5]).put("payment_status",if(i%2==0)"paid" else "unpaid").put("total_minor",(320+i*25)*100).put("pickup_number","A${88-i}").put("items",JSONArray().put(JSONObject().put("name","招牌紅燒牛肉麵").put("quantity",i%3+1).put("options",JSONArray()))))};return JSONObject().put("settings",JSONObject().put("accepting_orders",true).put("auto_accept_orders",false).put("dine_in_enabled",true).put("takeaway_enabled",true)).put("categories",cats).put("items",products).put("orders",orders).put("qrs",JSONArray().put(JSONObject().put("code","demo-secure-token-a1").put("label","桌號 A1").put("table_label","A1"))).put("dining_sessions",JSONArray()).put("option_groups",JSONArray().put(JSONObject().put("name","麵條")).put(JSONObject().put("name","辣度")))}
private fun demoDashboard()=JSONObject().put("ok",true)
private fun demoReport()=JSONObject().put("kpis",JSONObject().put("revenue_minor",2865000).put("orders",42).put("average_order_minor",68200).put("pending",3).put("new_members",4)).put("products",JSONArray().put(JSONObject().put("name","招牌紅燒牛肉麵").put("quantity",28).put("revenue_minor",532000)))
private fun demoMembers():JSONObject{val a=JSONArray();repeat(10){i->a.put(JSONObject().put("id","member-$i").put("name","示範會員 ${i+1}").put("phone","09••••${1000+i}").put("order_count",i+1).put("lifetime_spend_minor",(500+i*320)*100))};return JSONObject().put("members",a)}
