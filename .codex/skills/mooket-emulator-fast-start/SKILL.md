---
name: mooket-emulator-fast-start
description: Use when the user asks to start/open the MOOKET Android simulator/emulator/app quickly for UI review. Reuse an existing emulator first, start Mooket_Stable_API_30 only if none is connected, connect Metro on port 8081, and open com.mooketmobile without rebuilding or reinstalling unless explicitly requested.
---

# MOOKET Emulator Fast Start

Use this workflow for fast simulator review of MOOKET React Native UI changes.

## Paths

- Repo root: `D:\MooketMax`
- App root: `D:\MooketMax\mobile`
- ADB: `C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Emulator: `C:\Users\admin\AppData\Local\Android\Sdk\emulator\emulator.exe`
- Preferred AVD: `Mooket_Stable_API_30`
- Package/activity: `com.mooketmobile/.MainActivity`

## Rule

Do not rebuild or reinstall the APK by default.

For normal TS/TSX UI changes:

1. Reuse the already running emulator if possible.
2. Reuse or start Metro from `D:\MooketMax\mobile`.
3. Run `adb reverse tcp:8081 tcp:8081`.
4. Open `com.mooketmobile/.MainActivity`.

Only build/install when the user explicitly asks for a package, APK, rebuild, install, debug build, or release build.

## Fast Path

Check for a connected emulator:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' devices
```

If `emulator-5554 device` or another emulator device is listed, do not start a new emulator.

If no emulator is connected, start the stable AVD:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\emulator\emulator.exe' -avd Mooket_Stable_API_30
```

Wait until boot completes:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell getprop sys.boot_completed
```

Start Metro only if port `8081` is not already listening. Prefer an unrestricted PowerShell process because Metro must spawn transformer workers:

```powershell
cd D:\MooketMax\mobile
npm start -- --reset-cache --max-workers 1
```

Connect app to Metro and open it:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' reverse tcp:8081 tcp:8081
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell am start -n com.mooketmobile/.MainActivity
```

## Troubleshooting

- If the app opens an old screen, keep the emulator and Metro running and reload JS instead of rebuilding.
- If there is a Metro cache issue, restart Metro with `--reset-cache`.
- If the emulator shows a blank white screen after JS changes, inspect Metro output first.
- If Metro output contains `Failed to construct transformer: Error: spawn EPERM`, stop that Metro session and restart Metro from an unrestricted PowerShell process with `npm start -- --reset-cache --max-workers 1`.
- Do not diagnose a white screen as a UI/rendering bug until Metro has no `spawn EPERM` or transformer errors.
- If the emulator is unresponsive, prefer closing only the emulator process and restarting `Mooket_Stable_API_30`.
- If the package is missing, then and only then ask whether to install/build the APK.
