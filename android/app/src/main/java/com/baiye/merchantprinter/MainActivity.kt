package com.baiye.merchantprinter

import android.os.Bundle
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import com.baiye.merchantprinter.data.LocalStore
import com.baiye.merchantprinter.network.MerchantApi
import com.baiye.merchantprinter.service.PrintService

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = LocalStore(this)
        val api = MerchantApi(store)
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
        if (store.printer()?.autoPrint == true && store.hasSession()) PrintService.start(this)
        setContent { MerchantPrinterApp(store, api) }
    }
}

@Composable
fun MerchantPrinterApp(store: LocalStore, api: MerchantApi) = DiningSpiritApp(store, api)
