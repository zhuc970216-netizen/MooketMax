---
name: mooket-fast-refresh-workflow
description: Use for MOOKETMAX React Native app UI/page/interaction changes. Default to Metro Fast Refresh for simulator verification instead of rebuilding and reinstalling APK, unless the user explicitly asks to build, package, install, release, or create an APK.
---

# MOOKETMAX Fast Refresh Workflow

## Rule

For normal React Native frontend changes in this project, do not rebuild and reinstall the APK by default.

Use Metro Fast Refresh so the user can review changes quickly in the simulator.

Only run a full Android build/install when the user explicitly asks for:

- build package
- debug package
- release package
- install APK
- rebuild
- create latest package
- version/release delivery

## Applies To

Use Fast Refresh for:

- TS/TSX page logic
- React Native component changes
- layout, spacing, color, font, card, tab, list, modal, and button style changes
- frontend filtering, grouping, sorting, and display logic
- text copy changes
- API response rendering changes when no native dependency is changed

## Full Build Is Required For

Run Gradle build/install only for:

- files under `mobile/android/`
- native Android code or manifest changes
- package name, permissions, icon, splash screen, versionCode, versionName
- Gradle configuration
- adding or upgrading native npm modules
- release/debug APK delivery
- explicit user request to build or install

## Fast Refresh Setup

From the repo root:

```powershell
cd mobile
npm start -- --reset-cache
```

Then make the simulator connect to Metro:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' reverse tcp:8081 tcp:8081
```

Open the app in the simulator:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell am start -n com.mooketmobile/.MainActivity
```

After editing JS/TS/TSX files, rely on Fast Refresh. If the screen does not update, trigger a React Native reload from the dev menu or restart only the JS app, not the APK build.

## Working Agreement

When the user says they want to review UI/page changes quickly, keep Metro running and update the simulator through Fast Refresh.

When reporting status, say whether the simulator is showing Fast Refresh content or an installed APK build.
