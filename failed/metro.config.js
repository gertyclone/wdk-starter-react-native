const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { configureMetroForWDK } = require('@tetherto/wdk-react-native-provider/metro-polyfills');
const { resolve } = require('metro-resolver');

const config = getDefaultConfig(__dirname);

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
  // Override module resolution for @wdk/wallet-btc to use local directory
  // Metro bundler has issues with symlinks, so we explicitly map it
  extraNodeModules: {
    '@wdk/wallet-btc': path.resolve(__dirname, '../wdk-wallet-btc'),
  },
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
};

// Apply WDK polyfills configuration first (handles Node.js core module polyfills)
const wdkConfig = configureMetroForWDK(config);

// Add watchFolders to include external wdk-wallet-btc directory
// This allows Metro to watch files outside the project root for SHA-1 computation
wdkConfig.watchFolders = [
  ...(wdkConfig.watchFolders || []),
  path.resolve(__dirname, '../wdk-wallet-btc'),
];

// Ensure extraNodeModules is merged properly after WDK config
// Metro bundler has issues with symlinks, so we explicitly map @wdk/wallet-btc
wdkConfig.resolver.extraNodeModules = {
  ...(wdkConfig.resolver.extraNodeModules || {}),
  '@wdk/wallet-btc': path.resolve(__dirname, '../wdk-wallet-btc'),
};

// Now wrap the WDK's resolveRequest with our custom alias logic
const wdkResolveRequest = wdkConfig.resolver.resolveRequest;

wdkConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @wdk/wallet-btc FIRST - before any other resolution
  // Metro bundler has issues with symlinks, so we explicitly resolve to the local directory
  // This must be checked before delegating to avoid symlink resolution issues
  if (moduleName === '@wdk/wallet-btc') {
    const localWalletBtcPath = path.resolve(__dirname, '../wdk-wallet-btc');
    const fs = require('fs');
    
    if (fs.existsSync(localWalletBtcPath)) {
      try {
        // Use Metro's resolver to resolve from the local directory
        // Create a modified context that points to the local directory
        const modifiedContext = {
          ...context,
          // Override nodeModulesPaths to include the local directory's parent
          // This allows Metro to resolve the package correctly
          originModulePath: context.originModulePath,
          resolveRequest: context.resolveRequest,
        };
        
        // Try to resolve using Metro's resolver with the local path
        // We'll resolve it as if it's in node_modules
        const packageJsonPath = path.join(localWalletBtcPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = require(packageJsonPath);
          const mainEntry = packageJson.main || 'index.js';
          const resolvedPath = path.resolve(localWalletBtcPath, mainEntry);
          
          if (fs.existsSync(resolvedPath)) {
            return {
              type: 'sourceFile',
              filePath: resolvedPath,
            };
          }
          
          // Fallback to index.js
          const indexPath = path.join(localWalletBtcPath, 'index.js');
          if (fs.existsSync(indexPath)) {
            return {
              type: 'sourceFile',
              filePath: indexPath,
            };
          }
        }
      } catch (e) {
        // If resolution fails, fall through to default resolver
        console.warn('[Metro] Failed to resolve @wdk/wallet-btc locally:', e.message);
      }
    }
  }

  // Handle @/ alias
  if (moduleName.startsWith('@/')) {
    const resolvedPath = moduleName.replace('@/', path.resolve(__dirname, 'src') + '/');
    try {
      return context.resolveRequest(context, resolvedPath, platform);
    } catch (e) {
      // If the resolved path fails, fall through to WDK resolver
    }
  }

  // Delegate to WDK's resolveRequest
  return wdkResolveRequest(context, moduleName, platform);
};

module.exports = wdkConfig;
