package com.baiye.merchantprinter

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.rule.GrantPermissionRule
import org.junit.Rule
import org.junit.rules.RuleChain
import org.junit.Test

class AppSmokeTest {
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val rules: RuleChain = RuleChain
        .outerRule(GrantPermissionRule.grant(android.Manifest.permission.POST_NOTIFICATIONS))
        .around(compose)

    @Test fun launchShowsLoginOrHome() {
        compose.waitUntil(timeoutMillis = 10_000) {
            runCatching {
                compose.onAllNodes(hasTestTag("login-screen") or hasTestTag("home-screen"))
                    .fetchSemanticsNodes()
                    .isNotEmpty()
            }.getOrDefault(false)
        }
        val login = compose.onAllNodes(hasTestTag("login-screen")).fetchSemanticsNodes()
        if (login.isNotEmpty()) compose.onNodeWithTag("login-screen").assertIsDisplayed()
        else compose.onNodeWithTag("home-screen").assertIsDisplayed()
    }
}
