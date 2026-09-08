package com.baiye.merchantprinter

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

internal object DiningSpiritTokens {
    val Primary = Color(0xFF0F766E)
    val Background = Color(0xFFF7F8FA)
    val Surface = Color(0xFFFFFFFF)
    val Text = Color(0xFF182230)
    val MutedText = Color(0xFF52606D)
    val Divider = Color(0xFFE3E7EC)
    val Success = Color(0xFF087A55)
    val Warning = Color(0xFF9A5B00)
    val Danger = Color(0xFFB42318)
}

private val LightColors = lightColorScheme(
    primary = DiningSpiritTokens.Primary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD8F4EF),
    onPrimaryContainer = Color(0xFF064E48),
    secondary = Color(0xFF356A67),
    secondaryContainer = Color(0xFFE7F1F0),
    onSecondaryContainer = Color(0xFF243C3B),
    tertiary = Color(0xFF315F8C),
    error = DiningSpiritTokens.Danger,
    errorContainer = Color(0xFFFEE4E2),
    onErrorContainer = Color(0xFF7A271A),
    background = DiningSpiritTokens.Background,
    onBackground = DiningSpiritTokens.Text,
    surface = DiningSpiritTokens.Surface,
    onSurface = DiningSpiritTokens.Text,
    surfaceVariant = Color(0xFFF1F4F7),
    onSurfaceVariant = DiningSpiritTokens.MutedText,
    outline = Color(0xFF98A2B3),
    outlineVariant = DiningSpiritTokens.Divider,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF75D5C9),
    onPrimary = Color(0xFF003733),
    primaryContainer = Color(0xFF07534E),
    onPrimaryContainer = Color(0xFFD8F4EF),
    secondary = Color(0xFFAECBC8),
    secondaryContainer = Color(0xFF294541),
    onSecondaryContainer = Color(0xFFE2F1EF),
    tertiary = Color(0xFFA6C8EC),
    error = Color(0xFFFFB4AB),
    errorContainer = Color(0xFF7A271A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF101615),
    onBackground = Color(0xFFE7EEEC),
    surface = Color(0xFF17201F),
    onSurface = Color(0xFFE7EEEC),
    surfaceVariant = Color(0xFF24302E),
    onSurfaceVariant = Color(0xFFC2CECB),
    outline = Color(0xFF899592),
    outlineVariant = Color(0xFF34413F),
)

private val AppTypography = Typography(
    headlineLarge = TextStyle(fontSize = 24.sp, lineHeight = 31.sp, fontWeight = FontWeight.Bold),
    headlineMedium = TextStyle(fontSize = 22.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium),
)

@Composable
internal fun DiningSpiritTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val colors = if (dark) DarkColors else LightColors
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = colors.background.toArgb()
            window.navigationBarColor = colors.background.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    MaterialTheme(colorScheme = colors, typography = AppTypography, content = content)
}
