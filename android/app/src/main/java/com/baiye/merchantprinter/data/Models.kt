package com.baiye.merchantprinter.data

data class PrinterConfig(
    val id: String = "", val name: String = "XP-N160II Kitchen Printer",
    val model: String = "Xprinter XP-N160II", val host: String = "192.168.1.200",
    val port: Int = 9100, val paperWidthMm: Int = 80,
    val enabled: Boolean = true, val autoPrint: Boolean = false, val copies: Int = 1,
) {
    val canAutoClaim: Boolean get() = enabled && autoPrint
}

data class OrderOption(val group: String, val value: String)
data class OrderItem(val name: String, val quantity: Int, val note: String = "", val options: List<OrderOption> = emptyList())
data class MerchantOrder(
    val code: String, val table: String, val type: String, val status: String,
    val paymentMethod: String, val totalMinor: Int, val createdAt: String,
    val customerNote: String = "", val items: List<OrderItem> = emptyList(),
)

data class OrderEvent(
    val sequence: Long, val eventId: String, val eventType: String,
    val orderId: String, val orderCode: String, val table: String,
    val status: String, val paymentStatus: String, val itemCount: Int,
    val totalMinor: Int, val createdAt: String,
)

data class PrintJob(
    val id: String, val orderCode: String, val printerId: String, val status: String,
    val copies: Int, val attemptCount: Int, val payloadJson: String,
    val claimToken: String = "", val localState: String = "DISCOVERED",
    val deliveryOutcome: String = "not_started", val lastError: String = "",
    val claimRequestId: String = "",
)

enum class PrinterReachability { UNKNOWN, NETWORK_REACHABLE, OFFLINE, ERROR }

object LocalJobState {
    const val CLAIMED_DURABLE = "CLAIMED_DURABLE"
    const val PRINTING_INTENT = "PRINTING_INTENT"
    const val WRITE_COMPLETED_AWAITING_ACK = "WRITE_COMPLETED_AWAITING_ACK"
    const val PRINTED_ACKED = "PRINTED_ACKED"
    const val SAFE_FAILURE = "SAFE_FAILURE"
    const val AMBIGUOUS = "AMBIGUOUS"
}
