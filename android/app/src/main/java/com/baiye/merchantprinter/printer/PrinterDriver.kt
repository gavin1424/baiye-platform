package com.baiye.merchantprinter.printer

import android.content.Context
import com.baiye.merchantprinter.data.PrinterConfig
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket

interface PrinterConnection { fun test(config: PrinterConfig, timeoutMs: Int = 3000) }
interface PrinterDriver : PrinterConnection { fun print(config: PrinterConfig, bytes: ByteArray): Int }

class LanEscPosPrinter : PrinterDriver {
    override fun test(config: PrinterConfig, timeoutMs: Int) {
        Socket().use { it.connect(InetSocketAddress(config.host, config.port), timeoutMs) }
    }
    override fun print(config: PrinterConfig, bytes: ByteArray): Int {
        val socket = Socket()
        try {
            socket.connect(InetSocketAddress(config.host, config.port), 5000)
        } catch (error: Exception) {
            socket.close()
            throw PrinterIoException("${config.host}:${config.port} ${error.message ?: "printer offline"}", false, error)
        }
        try {
            socket.use { it.getOutputStream().use { output -> output.write(bytes); output.flush() } }
            return bytes.size
        } catch (error: Exception) {
            socket.close()
            throw PrinterIoException("write may be partial: ${error.message ?: "write failure"}", true, error)
        }
    }
}

class MockPrinter(private val context: Context) : PrinterDriver {
    override fun test(config: PrinterConfig, timeoutMs: Int) = Unit
    override fun print(config: PrinterConfig, bytes: ByteArray): Int {
        val directory = File(context.filesDir, "mock-printer").apply { mkdirs() }
        File(directory, "receipt-${System.currentTimeMillis()}.escpos").writeBytes(bytes)
        return bytes.size
    }
}

class PrinterIoException(message: String, val ambiguous: Boolean, cause: Throwable) : Exception(message, cause)
