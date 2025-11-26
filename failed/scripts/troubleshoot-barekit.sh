#!/bin/bash

# BareKit Troubleshooting Script
# This script helps diagnose BareKit bundle issues in Android builds

set -e

echo "=== BareKit Troubleshooting ==="
echo ""

# Check 1: Bundle file exists
echo "1. Checking if bundle file exists..."
BUNDLE_PATH="node_modules/@tetherto/pear-wrk-wdk/bundle/wdk-worklet.mobile.bundle.js"
if [ -f "$BUNDLE_PATH" ]; then
    echo "   ✓ Bundle file exists"
    BUNDLE_SIZE=$(ls -lh "$BUNDLE_PATH" | awk '{print $5}')
    BUNDLE_DATE=$(stat -f "%Sm" "$BUNDLE_PATH")
    BUNDLE_HASH=$(md5 -q "$BUNDLE_PATH")
    echo "   - Size: $BUNDLE_SIZE"
    echo "   - Modified: $BUNDLE_DATE"
    echo "   - MD5: $BUNDLE_HASH"
else
    echo "   ✗ Bundle file MISSING!"
    echo "   Run: npm run gen:bundle"
    exit 1
fi

# Check 2: Bundle contains wallet-btc references
echo ""
echo "2. Checking bundle content..."
if grep -q "wallet-btc\|@wdk/wallet-btc" "$BUNDLE_PATH" 2>/dev/null; then
    echo "   ✓ Bundle contains wallet-btc references"
else
    echo "   ⚠ Bundle may not contain wallet-btc (checking first 1000 chars)..."
    head -c 1000 "$BUNDLE_PATH" | grep -q "wallet" && echo "   - Contains 'wallet' references" || echo "   - No 'wallet' found in preview"
fi

# Check 3: Symlink status
echo ""
echo "3. Checking @wdk/wallet-btc symlink status..."
if [ -L "node_modules/@wdk/wallet-btc" ]; then
    LINK_TARGET=$(readlink "node_modules/@wdk/wallet-btc")
    echo "   ✓ Top-level symlink exists: $LINK_TARGET"
    if [ -f "$LINK_TARGET/index.js" ]; then
        echo "   ✓ Symlink target is valid"
    else
        echo "   ✗ Symlink target is invalid!"
    fi
else
    echo "   ⚠ Top-level symlink not found (may be normal if using override)"
fi

# Check 4: Nested symlink in pear-wrk-wdk
echo ""
echo "4. Checking nested symlink in @tetherto/pear-wrk-wdk..."
NESTED_PATH="node_modules/@tetherto/pear-wrk-wdk/node_modules/@wdk/wallet-btc"
if [ -L "$NESTED_PATH" ]; then
    NESTED_TARGET=$(readlink -f "$NESTED_PATH")
    echo "   ✓ Nested symlink exists: $NESTED_TARGET"
    if [ -f "$NESTED_TARGET/index.js" ]; then
        echo "   ✓ Nested symlink target is valid"
    else
        echo "   ✗ Nested symlink target is invalid!"
    fi
elif [ -d "$NESTED_PATH" ]; then
    echo "   ⚠ Nested directory exists but is not a symlink (may be a copy)"
else
    echo "   ℹ No nested directory found (may be normal)"
fi

# Check 5: Android build artifacts
echo ""
echo "5. Checking Android build status..."
if [ -d "android/app/build" ]; then
    echo "   ✓ Android build directory exists"
    if [ -f "android/app/build/outputs/apk/debug/app-debug.apk" ]; then
        APK_SIZE=$(ls -lh "android/app/build/outputs/apk/debug/app-debug.apk" | awk '{print $5}')
        echo "   ✓ Debug APK exists ($APK_SIZE)"
    else
        echo "   ⚠ Debug APK not found (may need to build)"
    fi
else
    echo "   ⚠ Android build directory not found (run: npm run android)"
fi

# Check 6: Metro config
echo ""
echo "6. Checking Metro configuration..."
if grep -q "@wdk/wallet-btc" metro.config.js 2>/dev/null; then
    echo "   ✓ Metro config includes @wdk/wallet-btc override"
else
    echo "   ⚠ Metro config may not have @wdk/wallet-btc override"
fi

# Check 7: Package.json override
echo ""
echo "7. Checking package.json overrides..."
if grep -q '"@wdk/wallet-btc"' package.json 2>/dev/null; then
    echo "   ✓ package.json has @wdk/wallet-btc override"
    OVERRIDE=$(grep -A 1 '"@wdk/wallet-btc"' package.json | tail -1)
    echo "   - Override: $OVERRIDE"
else
    echo "   ⚠ package.json may not have @wdk/wallet-btc override"
fi

echo ""
echo "=== Troubleshooting Complete ==="
echo ""
echo "Next steps if issues persist:"
echo "1. Get crash logs: adb logcat -d | grep -i -E '(error|exception|crash|fatal|barekit|wdk)' | tail -100"
echo "2. Check if bundle is in APK: unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep wdk-worklet"
echo "3. Regenerate bundle: npm run gen:bundle"
echo "4. Clean rebuild: cd android && ./gradlew clean && cd .. && npm run android"

