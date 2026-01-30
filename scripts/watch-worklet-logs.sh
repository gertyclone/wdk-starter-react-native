#!/bin/bash

# Script to watch worklet logs specifically
# Usage: ./scripts/watch-worklet-logs.sh

echo "Watching worklet logs from Android device..."
echo "Press Ctrl+C to stop"
echo ""
echo "Filtering for wallet-account-read-only-btc and worklet-related logs"
echo ""

# Filter for worklet-related logs
adb logcat | grep -iE '(wallet-account|worklet|wdk-wallet-btc|console|ReactNativeJS)'
