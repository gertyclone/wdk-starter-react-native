# BareKit Troubleshooting Guide

## Quick Diagnosis

Run the troubleshooting script:
```bash
./scripts/troubleshoot-barekit.sh
```

## Common Issues and Solutions

### 1. Bundle File Missing

**Symptoms:** App crashes on startup, bundle file not found

**Solution:**
```bash
npm run gen:bundle
```

Verify bundle exists:
```bash
ls -lh node_modules/@tetherto/pear-wrk-wdk/bundle/wdk-worklet.mobile.bundle.js
```

### 2. Bundle Not Included in APK

**Symptoms:** Bundle exists but app still crashes

**Check if bundle is in APK:**
```bash
unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep wdk-worklet
```

**Solution:** Rebuild the app:
```bash
cd android
./gradlew clean --exclude-task externalNativeBuildCleanDebug
cd ..
npm run android
```

### 3. Get Crash Logs

**After app crashes, get detailed logs:**
```bash
# Clear logcat first
adb logcat -c

# Reproduce the crash, then:
adb logcat -d | grep -i -E '(error|exception|crash|fatal|barekit|wdk|reactnative)' | tail -100
```

**For more detailed logs:**
```bash
adb logcat -d > crash.log
# Then search crash.log for errors
```

### 4. Verify Bundle Content

**Check if bundle includes wallet-btc:**
```bash
grep -c "wallet-btc\|@wdk/wallet-btc" node_modules/@tetherto/pear-wrk-wdk/bundle/wdk-worklet.mobile.bundle.js
```

**Check bundle hash:**
```bash
md5 node_modules/@tetherto/pear-wrk-wdk/bundle/wdk-worklet.mobile.bundle.js
```

### 5. Check Symlink Status

**Verify local wallet-btc is linked correctly:**
```bash
# Top-level symlink
ls -la node_modules/@wdk/wallet-btc

# Nested symlink
ls -la node_modules/@tetherto/pear-wrk-wdk/node_modules/@wdk/wallet-btc

# Both should point to ../wdk-wallet-btc
```

### 6. Clean Rebuild Process

**Full clean rebuild (recommended when bundle changes):**
```bash
# 1. Regenerate bundle
npm run gen:bundle

# 2. Clean Android build (skip CMake clean to avoid codegen issues)
cd android
./gradlew clean --exclude-task externalNativeBuildCleanDebug
cd ..

# 3. Rebuild app
npm run android
```

### 7. Verify Metro Configuration

**Check Metro config has wallet-btc override:**
```bash
grep -A 2 "@wdk/wallet-btc" metro.config.js
```

Should show:
- `extraNodeModules` mapping
- Custom `resolveRequest` handler

### 8. Check Package.json Override

**Verify override is configured:**
```bash
grep -A 1 '"@wdk/wallet-btc"' package.json
```

Should show:
```json
"overrides": {
  "@wdk/wallet-btc": "file:../wdk-wallet-btc"
}
```

## Step-by-Step Troubleshooting

1. **Run diagnostic script:**
   ```bash
   ./scripts/troubleshoot-barekit.sh
   ```

2. **Get crash logs:**
   ```bash
   adb logcat -d | grep -i -E '(error|exception|crash|fatal)' | tail -100
   ```

3. **Check bundle status:**
   - Bundle exists?
   - Bundle size reasonable (~19MB)?
   - Bundle includes wallet-btc references?

4. **Verify build artifacts:**
   - APK exists?
   - Bundle included in APK?

5. **Check symlinks:**
   - Top-level symlink valid?
   - Nested symlink valid?

6. **Clean rebuild if needed:**
   ```bash
   npm run gen:bundle
   cd android && ./gradlew clean --exclude-task externalNativeBuildCleanDebug && cd ..
   npm run android
   ```

## Common Error Patterns

### "Unable to resolve module"
- **Cause:** Metro bundler can't find module
- **Fix:** Check Metro config, clear Metro cache: `npx expo start --clear`

### "Bundle file not found"
- **Cause:** Bundle not generated or not included in build
- **Fix:** Run `npm run gen:bundle` and rebuild

### "Native module not found"
- **Cause:** Native code not built or linked
- **Fix:** Clean rebuild Android project

### "Worklet initialization failed"
- **Cause:** Bundle corrupted or incompatible
- **Fix:** Regenerate bundle and rebuild

## Getting Help

When reporting issues, include:
1. Output of `./scripts/troubleshoot-barekit.sh`
2. Crash logs from `adb logcat`
3. Bundle hash: `md5 node_modules/@tetherto/pear-wrk-wdk/bundle/wdk-worklet.mobile.bundle.js`
4. Android build output
5. Metro bundler output (if applicable)

