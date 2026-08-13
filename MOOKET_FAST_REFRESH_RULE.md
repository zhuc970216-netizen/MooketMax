# MOOKET Fast Refresh Rule

For MOOKETMAX React Native frontend work, use this as the fixed review workflow.

## Default

For page, style, interaction, and TS/TSX frontend logic changes:

- use Metro Fast Refresh
- update the simulator directly
- do not rebuild and reinstall APK by default

## Build Only When Explicitly Requested

Only run Gradle build/install when the user explicitly asks for:

- build
- package
- install APK
- debug APK
- release APK
- release delivery

## Fast Refresh Commands

Start Metro:

```powershell
cd C:\Users\admin\Documents\MOOKET全网报盘\MOOKETMAX-REACT\mobile
npm start -- --reset-cache
```

Connect the simulator to Metro:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' reverse tcp:8081 tcp:8081
```

Open the app:

```powershell
& 'C:\Users\admin\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell am start -n com.mooketmobile/.MainActivity
```

## Project Skill

The same workflow is also stored as a local project skill:

```text
.codex/skills/mooket-fast-refresh-workflow/SKILL.md
```
