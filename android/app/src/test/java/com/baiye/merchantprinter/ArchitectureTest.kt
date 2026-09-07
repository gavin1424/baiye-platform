package com.baiye.merchantprinter

import com.baiye.merchantprinter.data.LocalJobState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ArchitectureTest {
    @Test fun ambiguousIsNotSafeFailure() = assertNotEquals(LocalJobState.AMBIGUOUS, LocalJobState.SAFE_FAILURE)
    @Test fun ackPendingIsDistinctFromPrintIntent() = assertNotEquals(LocalJobState.WRITE_COMPLETED_AWAITING_ACK, LocalJobState.PRINTING_INTENT)
    @Test fun printedStateIsStable() = assertEquals("PRINTED_ACKED", LocalJobState.PRINTED_ACKED)
}
