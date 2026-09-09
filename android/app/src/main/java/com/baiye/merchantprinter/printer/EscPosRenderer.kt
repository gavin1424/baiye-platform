package com.baiye.merchantprinter.printer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class ChineseRenderMode { BITMAP, NATIVE_BIG5_EXPERIMENTAL }

class EscPosRenderer(private val mode: ChineseRenderMode = ChineseRenderMode.BITMAP) {
    private val init = byteArrayOf(0x1B, 0x40)
    private val cut = byteArrayOf(0x1D, 0x56, 0x42, 0x00)

    fun kitchen(payloadJson: String): ByteArray {
        val payload = JSONObject(payloadJson)
        val lines = buildList {
            add(Line("================================", 25f, Paint.Align.CENTER, true))
            add(Line(payload.optString("merchant_name", "百工牛肉麵"), 42f, Paint.Align.CENTER, true))
            add(Line(if (payload.optBoolean("reprint")) "【補印】" else "【新單】", 42f, Paint.Align.CENTER, true))
            add(Line("================================", 25f, Paint.Align.CENTER, true))
            val table = payload.optString("table_label").ifBlank { if (payload.optString("order_type") == "takeaway") "外帶" else "無桌號" }
            add(Line(table, 76f, Paint.Align.CENTER, true))
            add(Line("訂單：${payload.optString("order_code")}", 30f, Paint.Align.LEFT, true))
            add(Line("時間：${formatTime(payload.optString("created_at"))}", 26f))
            add(Line("類型：${if (payload.optString("order_type") == "takeaway") "外帶" else "內用"}", 28f))
            add(Line("--------------------------------", 25f))
            var totalQuantity = 0
            val items = payload.optJSONArray("items")
            for (index in 0 until (items?.length() ?: 0)) {
                val item = items!!.getJSONObject(index); val quantity = item.optInt("quantity", 1); totalQuantity += quantity
                add(Line("$quantity x ${item.optString("name")}", 38f, Paint.Align.LEFT, true))
                val options = item.optJSONArray("options")
                for (optionIndex in 0 until (options?.length() ?: 0)) {
                    val option = options!!.getJSONObject(optionIndex)
                    add(Line("    ${option.optString("group_name")}：${option.optString("value_name")}", 28f))
                }
                val note = item.optString("note")
                if (note.isNotBlank()) add(Line("※※ $note ※※", 34f, Paint.Align.LEFT, true))
                add(Line("--------------------------------", 25f))
            }
            val customerNote = payload.optString("customer_note")
            if (customerNote.isNotBlank()) { add(Line("整單備註：", 30f, bold = true)); add(Line("※※ $customerNote ※※", 34f, bold = true)) }
            add(Line("================================", 25f))
            add(Line("共 $totalQuantity 項", 34f, bold = true))
            add(Line("付款：${paymentName(payload.optString("payment_method"))}", 30f))
            add(Line("總額：NT$ ${payload.optInt("total_minor") / 100}", 42f, bold = true))
            add(Line("================================", 25f))
            add(Line(if (payload.optBoolean("reprint")) "補印" else "新單", 44f, Paint.Align.CENTER, true))
            add(Line("================================", 25f)); add(Line("", 26f)); add(Line("", 26f))
        }
        return if (mode == ChineseRenderMode.NATIVE_BIG5_EXPERIMENTAL) native(lines) else raster(lines)
    }

    fun testReceipt(now: Date = Date()): ByteArray {
        return raster(listOf(
            Line("==============================", 25f, Paint.Align.CENTER, true),
            Line("點餐靈", 42f, Paint.Align.CENTER, true),
            Line("百工牛肉麵", 38f, Paint.Align.CENTER, true),
            Line("==============================", 25f, Paint.Align.CENTER, true),
            Line("", 24f), Line("Xprinter XP-N160II", 30f, Paint.Align.CENTER, true),
            Line("測試列印成功", 34f, Paint.Align.CENTER, true), Line("", 24f),
            Line("時間：", 28f), Line(SimpleDateFormat("yyyy/MM/dd HH:mm:ss", Locale.TAIWAN).format(now), 28f),
            Line("==============================", 25f, Paint.Align.CENTER, true), Line("", 24f), Line("", 24f),
        ))
    }

    private fun raster(lines: List<Line>): ByteArray {
        val width = 576; val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK }
        val wrapped = lines.flatMap { line -> wrap(line, paint, width - 32) }
        val heights = wrapped.map { (it.size * 1.28f).toInt().coerceAtLeast(32) }
        val bitmap = Bitmap.createBitmap(width, heights.sum() + 16, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap); canvas.drawColor(Color.WHITE); var y = 8f
        wrapped.forEachIndexed { index, line ->
            paint.textSize = line.size; paint.textAlign = line.align; paint.typeface = if (line.bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            y += -paint.fontMetrics.top
            val x = when (line.align) { Paint.Align.CENTER -> width / 2f; Paint.Align.RIGHT -> width - 16f; else -> 16f }
            canvas.drawText(line.text, x, y, paint); y += (heights[index] + paint.fontMetrics.top)
        }
        val out = ByteArrayOutputStream(); out.write(init); out.write(bitmapCommand(bitmap)); out.write(byteArrayOf(0x0A, 0x0A)); out.write(cut); bitmap.recycle(); return out.toByteArray()
    }

    private fun native(lines: List<Line>): ByteArray = ByteArrayOutputStream().also { out ->
        out.write(init); out.write(byteArrayOf(0x1B, 0x74, 0x00))
        lines.forEach { line -> out.write(when(line.align) { Paint.Align.CENTER -> byteArrayOf(0x1B,0x61,0x01); Paint.Align.RIGHT -> byteArrayOf(0x1B,0x61,0x02); else -> byteArrayOf(0x1B,0x61,0x00) }); out.write(byteArrayOf(0x1B,0x45,if(line.bold) 1 else 0)); out.write(line.text.toByteArray(Charset.forName("Big5"))); out.write(0x0A) }
        out.write(cut)
    }.toByteArray()

    private fun bitmapCommand(bitmap: Bitmap): ByteArray {
        val widthBytes = (bitmap.width + 7) / 8; val data = ByteArray(widthBytes * bitmap.height)
        for (y in 0 until bitmap.height) for (x in 0 until bitmap.width) {
            val color = bitmap.getPixel(x, y); val luminance = (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114) / 1000
            if (luminance < 160) data[y * widthBytes + x / 8] = (data[y * widthBytes + x / 8].toInt() or (0x80 shr (x % 8))).toByte()
        }
        return byteArrayOf(0x1D, 0x76, 0x30, 0x00, (widthBytes and 0xFF).toByte(), ((widthBytes shr 8) and 0xFF).toByte(), (bitmap.height and 0xFF).toByte(), ((bitmap.height shr 8) and 0xFF).toByte()) + data
    }

    private fun wrap(line: Line, paint: Paint, maxWidth: Int): List<Line> {
        paint.textSize = line.size; paint.typeface = if (line.bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        if (paint.measureText(line.text) <= maxWidth) return listOf(line)
        val result = mutableListOf<Line>(); var current = ""
        line.text.forEach { char -> val candidate = current + char; if (current.isNotEmpty() && paint.measureText(candidate) > maxWidth) { result += line.copy(text = current); current = char.toString() } else current = candidate }
        if (current.isNotEmpty()) result += line.copy(text = current); return result
    }
    private fun formatTime(value: String) = value.replace('T', ' ').take(16).replace('-', '/')
    private fun paymentName(value: String) = when(value) { "cash" -> "現金"; "card" -> "刷卡"; "line_pay" -> "LINE Pay"; else -> "櫃台付款" }
    private data class Line(val text: String, val size: Float, val align: Paint.Align = Paint.Align.LEFT, val bold: Boolean = false)
}
