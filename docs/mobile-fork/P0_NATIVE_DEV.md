# Native dev — Stage A (local emulator) + Stage B (EAS)

## Stage A — local Android emulator ✅ VERIFIED (2026-08-04)

The universal Expo app runs **natively on Android** (not just the web bundle). Verified on a
headless, WHPX-accelerated Android 14 (API 34) emulator: Metro bundled 1374 modules, Expo Go
(SDK 56.0.0) launched `app/index.tsx`, and the `@bygsmart/core` workspace import rendered on
the native runtime (`workspace: bygsmart-core`). Screenshot evidence captured.

**Caveat (deliberate):** an emulator is **development evidence, not gate evidence.** It does not
faithfully reproduce background-upload survival across termination, memory pressure, thermal
throttling, real storage limits, biometric/camera/GPS hardware, or true network flapping — which
are exactly the offline-correctness behaviours D-11 and the chaos gate must prove. Those still
require a **physical device** (or a cloud real-device farm).

### Toolchain installed (portable, no admin) on this Windows host
- JDK 17 (MS OpenJDK, portable zip) → `%USERPROFILE%\Android\jdk17`
- Android command-line tools → `%USERPROFILE%\Android\sdk\cmdline-tools\latest`
- SDK packages: `platform-tools`, `emulator`, `platforms;android-34`,
  `system-images;android-34;google_apis;x86_64`, `build-tools;34.0.0`
- AVD: `bygsmart_test` (Pixel 6 profile)

### Run it
```
# env (per shell):  JAVA_HOME=%USERPROFILE%\Android\jdk17  ANDROID_HOME=%USERPROFILE%\Android\sdk
%ANDROID_HOME%\emulator\emulator.exe -avd bygsmart_test         # boot the emulator
cd apps/app && npx expo start --android                          # run on Android (Expo Go)
cd apps/app && npx expo start --web                              # run in the browser (PWA target)
```
Prerequisite: hardware virtualization / a hypervisor present (this host: `HypervisorPresent=True`).

## Stage B — EAS (cloud builds, no local Mac / NDK / gradle)

**Android cloud build ✅ VERIFIED (2026-08-04).** EAS project linked (`ce8fcd14…`, owner
`waypays-team`, Expo slug `byggeapp-native`). First preview build (id `47047d35…`) succeeded:
keystore auto-generated in the cloud, SDK 56.0.0, signed APK produced. The standalone APK
(`com.bygsmart.app`) was installed on the emulator and launched its own `MainActivity` (no
Expo Go, no Metro) — rendering the app with `@bygsmart/core` resolved in the production bundle.
Free-tier queue latency was ~2.5 h before the build ran (not a failure; consider a paid plan
for priority). **iOS build still needs Apple signing** (personal Apple ID for internal, or the
D-U-N-S Developer Program for distribution).

`eas.json` defines the build profiles. EAS builds real iOS + Android binaries in the cloud, so
we never need a local Mac or the heavy native toolchain, and the output can run on a **cloud
real-device farm** (which *does* satisfy "physical" for gate evidence).

### Owner step (one-time, gates B)
1. Create a **free Expo account** at expo.dev.
2. `cd apps/app && npx eas-cli login`
3. `npx eas-cli init` — creates the EAS project and writes `expo.extra.eas.projectId` into `app.json`.

### Then (Claude can drive once logged in)
```
cd apps/app
npx eas-cli build -p android --profile preview     # cloud APK — no Apple account needed
npx eas-cli build -p ios --profile preview         # needs Apple signing (see below)
```
- **Android** cloud builds need nothing but the Expo account.
- **iOS** cloud builds need **Apple signing** — a personal Apple ID allows limited internal/ad-hoc
  builds; full distribution needs the Apple **Developer Program (D-U-N-S)**, i.e. the same
  long-lead track as store submission. So iOS-on-real-hardware ultimately still depends on the
  Apple account.

Identity is set: `app.json` carries `ios.bundleIdentifier` / `android.package` = `com.bygsmart.app`.
