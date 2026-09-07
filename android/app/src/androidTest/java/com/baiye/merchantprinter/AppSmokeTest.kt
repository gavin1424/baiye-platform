package com.baiye.merchantprinter

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import org.junit.Rule
import org.junit.Test

class AppSmokeTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun launchShowsLoginOrHome() {
        val login = compose.onAllNodes(androidx.compose.ui.test.hasTestTag("login-screen")).fetchSemanticsNodes()
        if (login.isNotEmpty()) compose.onNodeWithTag("login-screen").assertIsDisplayed()
        else compose.onNodeWithTag("home-screen").assertIsDisplayed()
    }
}
