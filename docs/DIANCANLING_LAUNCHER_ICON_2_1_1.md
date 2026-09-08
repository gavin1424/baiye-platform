# 點餐靈 Launcher Icon 2.1.1

## Scope

This release changes launcher branding only. The application ID, merchant session,
Room data, printer configuration, ordering APIs, and signing configuration are
unchanged.

## Brand asset

The launcher mark uses a warm cream background with a deep teal bowl, two steam
shapes, chopsticks, and a tap gesture. Text was intentionally omitted so the mark
remains legible at launcher size.

The image-generation prompt used for the source artwork was:

> Create a polished square mobile app icon asset based on the attached reference for the Taiwanese restaurant SaaS app 點餐靈. Preserve the recognizable concept: a deep teal dining bowl, two rising steam shapes, a pair of warm amber chopsticks, and a white fingertip tapping a circular touch target on the front of the bowl. Remove all words, letters, captions, borders, drop shadows, mockup frame, and background. Use clean modern vector-like geometry, strong silhouettes, minimal subtle highlights, no tiny details. Center the entire symbol with generous transparent padding so every important element stays within the Android adaptive icon safe zone under circle, rounded-square, and squircle masks. Output a single isolated foreground symbol on a truly transparent alpha background, 1024x1024 PNG, no checkerboard pattern baked into the image.

Generation mode: built-in image generation. Because the generated PNG encoded a
checkerboard as RGB rather than alpha, the final foreground alpha and density
packaging were produced deterministically from that generated source.

Source and masters:

- `android/app/src/main/branding/ic_launcher_generated_source.png`
- `android/app/src/main/branding/ic_launcher_foreground_master.png`
- `android/app/src/main/branding/ic_launcher_safezone_master.png`

## Android resources

- Legacy launcher PNGs: mdpi through xxxhdpi.
- Adaptive icons: `mipmap-anydpi-v26`.
- Android 13 themed icons: `mipmap-anydpi-v33` plus a simplified bowl-and-steam
  monochrome vector.
- Android 12+ splash: AndroidX SplashScreen API with the same launcher mark on the
  warm cream background.

## QA

- Circle, rounded-square, and squircle mask preview: no clipping.
- Pixel API 37 app drawer: icon and `點餐靈` label displayed at launcher size.
- Light and dark launcher: full-color icon remains readable.
- Splash screen: centered mark on warm cream, no text or advertising.
- APK resource inspection: v26/v33 adaptive, round, and monochrome resources are
  compiled into the APK.
- Connected Android tests: 11/11 passed on the Pixel 7a API 37 emulator.

The first connected-test attempt was killed by the emulator low-memory killer at
2 GB RAM. The same suite passed after restarting the emulator with 4 GB; this was
an emulator resource issue rather than an application crash.
