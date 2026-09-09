package com.baiye.merchantprinter

import com.baiye.merchantprinter.data.LocalJobState
import com.baiye.merchantprinter.data.PrinterConfig
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ArchitectureTest {
    @Test fun ambiguousIsNotSafeFailure() = assertNotEquals(LocalJobState.AMBIGUOUS, LocalJobState.SAFE_FAILURE)
    @Test fun ackPendingIsDistinctFromPrintIntent() = assertNotEquals(LocalJobState.WRITE_COMPLETED_AWAITING_ACK, LocalJobState.PRINTING_INTENT)
    @Test fun printedStateIsStable() = assertEquals("PRINTED_ACKED", LocalJobState.PRINTED_ACKED)
    @Test fun disabledAutoPrintCannotClaimJobs() = assertFalse(PrinterConfig(enabled = true, autoPrint = false).canAutoClaim)
    @Test fun disabledPrinterCannotClaimJobs() = assertFalse(PrinterConfig(enabled = false, autoPrint = true).canAutoClaim)
    @Test fun enabledAutoPrintCanClaimJobs() = assertTrue(PrinterConfig(enabled = true, autoPrint = true).canAutoClaim)
}
