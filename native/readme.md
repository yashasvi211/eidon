# Android Build & Install Commands (React Native / Expo)

## Debug Build

Build the debug APK:

```bash
cd android
./gradlew assembleDebug
```

APK location:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

For a debug build, start the Metro server:

```bash
npx expo start --dev-client
```

Forward the Metro port to the device:

```bash
adb reverse tcp:8081 tcp:8081
```

---

## Release Build

Build the release APK:

```bash
cd android
./gradlew assembleRelease
```

APK location:

```text
app/build/outputs/apk/release/app-release.apk
```

Install on a connected device:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

> Release builds do **not** require Metro or `adb reverse`.

---

## Android App Bundle (Play Store)

Build an AAB:

```bash
cd android
./gradlew bundleRelease
```

Output:

```text
app/build/outputs/bundle/release/app-release.aab
```

---

## Useful ADB Commands

Check connected devices:

```bash
adb devices
```

List reverse port mappings:

```bash
adb reverse --list
```

Forward Metro port:

```bash
adb reverse tcp:8081 tcp:8081
```

Launch the app:

```bash
adb shell monkey -p com.eidon.app 1
```

Uninstall the app:

```bash
adb uninstall com.eidon.app
```

---

## One-Line Workflows

### Debug

```bash
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Release

```bash
cd android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```
