#!/bin/bash

# Script to watch Expo/React Native JavaScript logs from Android device
# Usage: ./scripts/watch-android-logs.sh

echo "Watching React Native JS logs from Android device..."
echo "Press Ctrl+C to stop"
echo ""

# Filter for React Native JS logs
adb logcat ReactNativeJS:V ReactNative:V chromium:V *:S

