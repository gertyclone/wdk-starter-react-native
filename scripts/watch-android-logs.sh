#!/bin/bash

# Script to watch Expo/React Native JavaScript logs from Android device
# Usage: ./scripts/watch-android-logs.sh

echo "Watching React Native JS logs from Android device..."
echo "Press Ctrl+C to stop"
echo ""
echo "Note: Worklet logs (from wallet-account-read-only-btc) may appear with different tags."
echo "If you don't see worklet logs, try running: adb logcat | grep -i 'wallet\|worklet\|console'"
echo ""

# Filter for React Native JS logs - expanded to catch worklet logs
# Added more tags to catch worklet console output
adb logcat ReactNativeJS:V ReactNative:V chromium:V console:V *:S

