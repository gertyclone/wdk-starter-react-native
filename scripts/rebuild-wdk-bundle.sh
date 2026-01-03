#!/bin/bash

# Script to rebuild the wdk-wallet-btc bundle with local changes
# This ensures that changes to the local wdk-wallet-btc package are included in the native bundle

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Rebuilding wdk-wallet-btc bundle with local changes...${NC}"

# Get the project root directory (where this script is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PEAR_WRK_PATH="$PROJECT_ROOT/node_modules/@tetherto/pear-wrk-wdk"
LOCAL_WDK_BTC_PATH="$( cd "$PROJECT_ROOT/../wdk-wallet-btc" && pwd )"

# Check if pear-wrk-wdk exists
if [ ! -d "$PEAR_WRK_PATH" ]; then
    echo -e "${RED}❌ Error: pear-wrk-wdk not found at $PEAR_WRK_PATH${NC}"
    echo "   Make sure you've run 'npm install' first"
    exit 1
fi

# Check if local wdk-wallet-btc exists
if [ ! -d "$LOCAL_WDK_BTC_PATH" ]; then
    echo -e "${RED}❌ Error: Local wdk-wallet-btc not found at $LOCAL_WDK_BTC_PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Updating pear-wrk-wdk to use local wdk-wallet-btc...${NC}"

# Update package.json to use local package
cd "$PEAR_WRK_PATH"
npm pkg set "dependencies.@wdk/wallet-btc=file:$LOCAL_WDK_BTC_PATH"

echo -e "${YELLOW}📥 Installing dependencies...${NC}"
npm install --silent

echo -e "${YELLOW}🔨 Rebuilding mobile bundle...${NC}"
npm run gen:mobile-bundle

# Verify the bundle was created
BUNDLE_PATH="$PEAR_WRK_PATH/bundle/wdk-worklet.mobile.bundle.js"
if [ -f "$BUNDLE_PATH" ]; then
    # Check if bundle contains our marker
    if grep -q "LOCAL PACKAGE ACTIVE" "$BUNDLE_PATH"; then
        echo -e "${GREEN}✅ Bundle rebuilt successfully with local changes!${NC}"
        echo -e "${YELLOW}📝 Bundle location: $BUNDLE_PATH${NC}"
    else
        echo -e "${YELLOW}⚠️  Bundle rebuilt, but 'LOCAL PACKAGE ACTIVE' marker not found${NC}"
        echo -e "${YELLOW}   This might be normal if you haven't added the marker yet${NC}"
    fi
else
    echo -e "${RED}❌ Error: Bundle file not found at $BUNDLE_PATH${NC}"
    exit 1
fi

echo ""
# Now rebuild wdk-react-native-provider's worker bundle
PROVIDER_PATH="$PROJECT_ROOT/node_modules/@tetherto/wdk-react-native-provider"
PROVIDER_SERVICE_FILE="$PROVIDER_PATH/lib/module/services/wdk-service/index.js"

if [ -d "$PROVIDER_PATH" ]; then
    echo ""
    echo -e "${YELLOW}📦 Patching wdk-react-native-provider error handling...${NC}"
    
    # Patch the provider to preserve LOCAL PACKAGE ACTIVE error messages
    if [ -f "$PROVIDER_SERVICE_FILE" ]; then
        # Check if already patched
        if ! grep -q "LOCAL PACKAGE ACTIVE" "$PROVIDER_SERVICE_FILE"; then
            # Use sed to add the preservation logic before throwing generic error
            sed -i.bak 's/if (insufficientBalancePatterns\.some(pattern => error?.message?.includes(pattern))) {/if (insufficientBalancePatterns.some(pattern => error?.message?.includes(pattern))) {\n        \/\/ Preserve original error message if it contains LOCAL PACKAGE ACTIVE marker\n        if (error?.message?.includes('\''LOCAL PACKAGE ACTIVE'\'')) {\n          throw new Error(error.message);\n        }/g' "$PROVIDER_SERVICE_FILE"
            rm -f "$PROVIDER_SERVICE_FILE.bak"
            echo -e "${GREEN}✅ Provider error handling patched!${NC}"
        else
            echo -e "${YELLOW}ℹ️  Provider already patched${NC}"
        fi
    fi
    
    echo -e "${YELLOW}📦 Rebuilding wdk-react-native-provider worker bundle...${NC}"
    cd "$PROVIDER_PATH"
    
    # The provider bundles pear-wrk-wdk from the root node_modules
    ROOT_PEAR_WRK="$PROJECT_ROOT/node_modules/@tetherto/pear-wrk-wdk"
    if [ -d "$ROOT_PEAR_WRK" ]; then
        PEAR_WRK_IMPORTS="$ROOT_PEAR_WRK/pack.imports.json"
        PEAR_WRK_SRC="$ROOT_PEAR_WRK/src/wdk-worklet.js"
        OUTPUT_BUNDLE="$PROVIDER_PATH/lib/module/services/wdk-service/wdk-worklet.mobile.bundle.js"
        
        if [ -f "$PEAR_WRK_IMPORTS" ] && [ -f "$PEAR_WRK_SRC" ]; then
            # Run bare-pack directly with correct paths
            npx bare-pack \
                --target ios-arm64 \
                --target ios-arm64-simulator \
                --target ios-x64-simulator \
                --target android-arm \
                --target android-arm64 \
                --target android-ia32 \
                --target android-x64 \
                --linked \
                --imports "$PEAR_WRK_IMPORTS" \
                --out "$OUTPUT_BUNDLE" \
                "$PEAR_WRK_SRC"
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Provider worker bundle rebuilt successfully!${NC}"
            else
                echo -e "${RED}❌ Error rebuilding provider worker bundle${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  pear-wrk-wdk files not found, skipping provider bundle rebuild${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  pear-wrk-wdk not found in root node_modules, skipping provider bundle rebuild${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  wdk-react-native-provider not found, skipping provider bundle rebuild${NC}"
fi

echo ""
echo -e "${GREEN}✅ All bundles rebuilt successfully!${NC}"
echo ""
echo -e "${YELLOW}📱 Next steps:${NC}"
echo -e "   1. Rebuild the Android app: ${GREEN}npm run android${NC}"
echo -e "   2. Or rebuild iOS app: ${GREEN}npm run ios${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: After making changes to wdk-wallet-btc, run this script again${NC}"

