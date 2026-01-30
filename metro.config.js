const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { configureMetroForWDK } = require('@tetherto/wdk-react-native-provider/metro-polyfills');

const config = getDefaultConfig(__dirname);

// Add watchFolders to watch the local wdk-wallet-btc package directory
// This is required for Metro to properly watch files outside the project root
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, '../wdk-wallet-btc'),
];

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter(ext => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  // Ensure module paths include root node_modules
  nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
};

// Apply WDK polyfills configuration first (handles Node.js core module polyfills)
const wdkConfig = configureMetroForWDK(config);

// Ensure watchFolders is preserved after WDK config
// This is critical for Metro to watch the local wdk-wallet-btc package
wdkConfig.watchFolders = [
  ...(wdkConfig.watchFolders || []),
  ...(config.watchFolders || []),
];

// Override node_modules resolution AFTER WDK config to use local wdk-wallet-btc package
// This ensures our override isn't overwritten by WDK's config
wdkConfig.resolver.extraNodeModules = {
  ...(wdkConfig.resolver.extraNodeModules || {}),
  '@wdk/wallet-btc': path.resolve(__dirname, '../wdk-wallet-btc'),
  '@spacesops/wdk-wallet-btc': path.resolve(__dirname, '../wdk-wallet-btc'),
};

// Now wrap the WDK's resolveRequest with our custom alias logic
const wdkResolveRequest = wdkConfig.resolver.resolveRequest;

wdkConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @/ alias
  if (moduleName.startsWith('@/')) {
    const resolvedPath = moduleName.replace('@/', path.resolve(__dirname, 'src') + '/');
    try {
      return context.resolveRequest(context, resolvedPath, platform);
    } catch (e) {
      // If the resolved path fails, fall through to WDK resolver
    }
  }

  // Handle local wdk-wallet-btc override for Metro bundler
  // This MUST run BEFORE delegating to WDK's resolver to ensure we intercept first
  if (moduleName === '@wdk/wallet-btc' || moduleName === '@spacesops/wdk-wallet-btc') {
    const localPackagePath = path.resolve(__dirname, '../wdk-wallet-btc');
    const indexPath = path.join(localPackagePath, 'index.js');
    
    // Log that we're intercepting this resolution (appears in Metro terminal, not app console)
    console.log(`[Metro Resolver] 🔍 Intercepting ${moduleName} -> ${indexPath}`);
    
    // Check if the index file exists
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
      console.log(`[Metro Resolver] ✅ Resolving ${moduleName} to local package: ${indexPath}`);
      // Return the file path directly - Metro will handle the rest
      // The extraNodeModules config ensures Metro knows where to find relative imports
      return {
        type: 'sourceFile',
        filePath: indexPath,
      };
    } else {
      console.warn(`[Metro Resolver] ❌ Local package index.js not found at: ${indexPath}`);
    }
  }

  // Delegate to WDK's resolveRequest
  return wdkResolveRequest(context, moduleName, platform);
};

module.exports = wdkConfig;
