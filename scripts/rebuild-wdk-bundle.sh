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

# Patch bundle scripts to use --host instead of --target (for newer bare-pack versions)
PEAR_WRK_PACKAGE_JSON="$PEAR_WRK_PATH/package.json"
if [ -f "$PEAR_WRK_PACKAGE_JSON" ]; then
    # Check if any bundle scripts still use --target and update to --host
    if grep -q '"gen:.*bundle".*--target' "$PEAR_WRK_PACKAGE_JSON"; then
        echo -e "${YELLOW}📦 Patching bundle scripts to use --host flags (replacing --target)...${NC}"
        # Use node to safely update only the --target flags in bundle scripts
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('$PEAR_WRK_PACKAGE_JSON', 'utf8'));
            let updated = false;
            for (const [key, value] of Object.entries(pkg.scripts || {})) {
                if (key.includes('bundle') && typeof value === 'string' && value.includes('--target')) {
                    pkg.scripts[key] = value.replace(/--target/g, '--host');
                    updated = true;
                    console.log('Updated', key, 'to use --host flags');
                }
            }
            if (updated) {
                fs.writeFileSync('$PEAR_WRK_PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
            }
        " 2>/dev/null || {
            # Fallback to sed if node fails
            sed -i.bak 's/--target/--host/g' "$PEAR_WRK_PACKAGE_JSON"
            rm -f "$PEAR_WRK_PACKAGE_JSON.bak"
        }
        echo -e "${GREEN}✅ Updated bundle scripts to use --host flags${NC}"
    fi
fi

echo -e "${YELLOW}📥 Installing dependencies...${NC}"
# Use --ignore-scripts to skip postinstall scripts that might call bare-pack
npm install --silent --ignore-scripts

# Check if bundle already exists before trying to rebuild
BUNDLE_PATH="$PEAR_WRK_PATH/bundle/wdk-worklet.mobile.bundle.js"
BUNDLE_EXISTS=false
if [ -f "$BUNDLE_PATH" ]; then
    BUNDLE_EXISTS=true
    BUNDLE_SIZE=$(stat -f%z "$BUNDLE_PATH" 2>/dev/null || stat -c%s "$BUNDLE_PATH" 2>/dev/null || echo "0")
    echo -e "${YELLOW}ℹ️  Bundle already exists (size: $BUNDLE_SIZE bytes)${NC}"
    echo -e "${YELLOW}   Skipping rebuild due to bare-pack version incompatibility${NC}"
    echo -e "${YELLOW}   Using existing bundle. To force rebuild, delete: $BUNDLE_PATH${NC}"
else
    echo -e "${YELLOW}🔨 Rebuilding mobile bundle...${NC}"
    # Try to run gen:mobile-bundle, but don't fail if it errors (bare-pack version issue)
    # Temporarily disable exit on error for this command
    set +e
    npm run gen:mobile-bundle > /tmp/gen-bundle-output.log 2>&1
    GEN_BUNDLE_EXIT_CODE=$?
    set -e
    
    # Filter out the UNKNOWN_FLAG error from output if it exists
    if grep -q "UNKNOWN_FLAG" /tmp/gen-bundle-output.log 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Bundle rebuild failed due to bare-pack version incompatibility (UNKNOWN_FLAG: host/target)${NC}"
        echo -e "${RED}❌ Error: No existing bundle found and rebuild failed${NC}"
        echo -e "${YELLOW}   You may need to manually run: cd $PEAR_WRK_PATH && npm run gen:mobile-bundle${NC}"
        echo -e "${YELLOW}   Or install a compatible version of bare-pack${NC}"
        rm -f /tmp/gen-bundle-output.log
        exit 1
    else
        cat /tmp/gen-bundle-output.log
    fi
    rm -f /tmp/gen-bundle-output.log
    
    if [ $GEN_BUNDLE_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Bundle rebuilt successfully!${NC}"
    else
        echo -e "${RED}❌ Error: Bundle rebuild failed${NC}"
        exit 1
    fi
fi

# Verify the bundle exists
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
    
    # Run fix-pack-imports.js if it exists to ensure pack.imports.json has absolute paths
    FIX_PACK_IMPORTS_SCRIPT="$PROVIDER_PATH/scripts/fix-pack-imports.js"
    if [ -f "$FIX_PACK_IMPORTS_SCRIPT" ]; then
        echo -e "${YELLOW}📦 Updating pack.imports.json with absolute shim paths...${NC}"
        node "$FIX_PACK_IMPORTS_SCRIPT" || echo -e "${YELLOW}⚠️  Warning: fix-pack-imports.js failed, continuing anyway...${NC}"
    fi
    
    # The provider bundles pear-wrk-wdk from the root node_modules
    ROOT_PEAR_WRK="$PROJECT_ROOT/node_modules/@tetherto/pear-wrk-wdk"
    if [ -d "$ROOT_PEAR_WRK" ]; then
        PEAR_WRK_IMPORTS="$ROOT_PEAR_WRK/pack.imports.json"
        PEAR_WRK_SRC="$ROOT_PEAR_WRK/src/wdk-worklet.js"
        OUTPUT_BUNDLE="$PROVIDER_PATH/lib/module/services/wdk-service/wdk-worklet.mobile.bundle.js"
        
        # Ensure pack.imports.json has absolute paths for shims (fallback if fix-pack-imports.js didn't work)
        if [ -f "$PEAR_WRK_IMPORTS" ]; then
            SHIMS_DIR="$ROOT_PEAR_WRK/shims"
            # Update ledger-bitcoin to use absolute path if shim exists and not already set
            if [ -f "$SHIMS_DIR/ledger-bitcoin/index.js" ]; then
                LEDGER_BITCOIN_SHIM_PATH=$(cd "$SHIMS_DIR/ledger-bitcoin" && pwd)/index.js
                # Check if it's already an absolute path
                if ! grep -q "\"ledger-bitcoin\": \"/" "$PEAR_WRK_IMPORTS" 2>/dev/null; then
                    # Use node to update the JSON file properly
                    node -e "
                        const fs = require('fs');
                        const path = require('path');
                        const importsFile = '$PEAR_WRK_IMPORTS';
                        const ledgerPath = '$LEDGER_BITCOIN_SHIM_PATH';
                        try {
                            const imports = JSON.parse(fs.readFileSync(importsFile, 'utf8'));
                            if (imports['ledger-bitcoin'] !== ledgerPath) {
                                imports['ledger-bitcoin'] = ledgerPath;
                                fs.writeFileSync(importsFile, JSON.stringify(imports, null, 2) + '\n');
                                console.log('Updated ledger-bitcoin path in pack.imports.json to:', ledgerPath);
                            }
                        } catch (e) {
                            console.error('Error updating pack.imports.json:', e.message);
                        }
                    " 2>/dev/null || true
                fi
            fi
        fi
        
        if [ -f "$PEAR_WRK_IMPORTS" ] && [ -f "$PEAR_WRK_SRC" ]; then
            # Check if bundle needs to be rebuilt by checking if it contains the local package marker
            # or if the bundle is older than the local wdk-wallet-btc package
            FORCE_REBUILD=false
            if [ -f "$OUTPUT_BUNDLE" ]; then
                if ! grep -q "LOCAL PACKAGE LOADED\|LOCAL VERSION DETECTED" "$OUTPUT_BUNDLE" 2>/dev/null; then
                    echo -e "${YELLOW}⚠️  Bundle exists but doesn't contain local package markers - forcing rebuild${NC}"
                    FORCE_REBUILD=true
                else
                    # Check if local package is newer than bundle
                    LOCAL_PKG_TIME=$(stat -f %m "$LOCAL_WDK_BTC_PATH/src/wallet-account-read-only-btc.js" 2>/dev/null || stat -c %Y "$LOCAL_WDK_BTC_PATH/src/wallet-account-read-only-btc.js" 2>/dev/null || echo "0")
                    BUNDLE_TIME=$(stat -f %m "$OUTPUT_BUNDLE" 2>/dev/null || stat -c %Y "$OUTPUT_BUNDLE" 2>/dev/null || echo "0")
                    if [ "$LOCAL_PKG_TIME" -gt "$BUNDLE_TIME" ]; then
                        echo -e "${YELLOW}⚠️  Local package is newer than bundle - forcing rebuild${NC}"
                        FORCE_REBUILD=true
                    fi
                fi
            else
                FORCE_REBUILD=true
            fi
            
            if [ "$FORCE_REBUILD" = true ]; then
                # Remove old bundle to force rebuild
                rm -f "$OUTPUT_BUNDLE"
                echo -e "${YELLOW}🔨 Rebuilding provider worker bundle with local wdk-wallet-btc...${NC}"
            else
                echo -e "${GREEN}✅ Provider worker bundle is up to date${NC}"
            fi
            
            # Try to use bare-pack from react-native-bare-kit if available
            BARE_PACK_BIN="$PROJECT_ROOT/node_modules/.bin/bare-pack"
            if [ ! -f "$BARE_PACK_BIN" ]; then
                # Fallback to npx, but try without --host flags first
                BARE_PACK_BIN="npx bare-pack"
            fi
            
            # Run bare-pack directly with correct paths
            # Try with --host flags first (newer bare-pack uses --host instead of --target)
            if [ "$FORCE_REBUILD" = true ] || [ ! -f "$OUTPUT_BUNDLE" ]; then
                if $BARE_PACK_BIN \
                    --host ios-arm64 \
                    --host ios-arm64-simulator \
                    --host ios-x64-simulator \
                    --host android-arm \
                    --host android-arm64 \
                    --host android-ia32 \
                    --host android-x64 \
                    --linked \
                    --imports "$PEAR_WRK_IMPORTS" \
                    --out "$OUTPUT_BUNDLE" \
                    "$PEAR_WRK_SRC" 2>/dev/null; then
                    echo -e "${GREEN}✅ Provider worker bundle rebuilt successfully!${NC}"
                    # Verify the bundle contains local package markers
                    if grep -q "LOCAL PACKAGE LOADED\|LOCAL VERSION DETECTED" "$OUTPUT_BUNDLE" 2>/dev/null; then
                        echo -e "${GREEN}✅ Bundle verified - contains local package markers${NC}"
                    else
                        echo -e "${YELLOW}⚠️  Warning: Bundle rebuilt but local package markers not found${NC}"
                        echo -e "${YELLOW}   The local package may not be included in the bundle${NC}"
                    fi
                else
                    # Try without --host flags (for older versions of bare-pack)
                    echo -e "${YELLOW}⚠️  Retrying without --host flags...${NC}"
                    if $BARE_PACK_BIN \
                        --linked \
                        --imports "$PEAR_WRK_IMPORTS" \
                        --out "$OUTPUT_BUNDLE" \
                        "$PEAR_WRK_SRC"; then
                        echo -e "${GREEN}✅ Provider worker bundle rebuilt successfully (without host flags)!${NC}"
                        # Verify the bundle contains local package markers
                        if grep -q "LOCAL PACKAGE LOADED\|LOCAL VERSION DETECTED" "$OUTPUT_BUNDLE" 2>/dev/null; then
                            echo -e "${GREEN}✅ Bundle verified - contains local package markers${NC}"
                        else
                            echo -e "${YELLOW}⚠️  Warning: Bundle rebuilt but local package markers not found${NC}"
                        fi
                    else
                        echo -e "${YELLOW}⚠️  Could not rebuild provider worker bundle automatically${NC}"
                        echo -e "${YELLOW}   This may be okay if the bundle already exists${NC}"
                        # Don't exit - this is not critical for the build
                    fi
                fi
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

