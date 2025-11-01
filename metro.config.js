const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { configureMetroForWDK } = require('@tetherto/wdk-react-native-provider/metro-polyfills');

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
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
};

// Apply WDK polyfills configuration first (handles Node.js core module polyfills)
const wdkConfig = configureMetroForWDK(config);

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

  // Handle react-native-bare-kit web shim for web platform
  if (platform === 'web') {
    // Handle main module
    if (moduleName === 'react-native-bare-kit') {
      const shimPath = path.resolve(__dirname, 'src/shims/react-native-bare-kit.web.ts');
      try {
        return {
          type: 'sourceFile',
          filePath: shimPath,
        };
      } catch (e) {
        // Fall through to default resolution
      }
    }
    // Handle react-native-bare-kit/specs/NativeBareKit path (absolute or relative)
    if (moduleName === 'react-native-bare-kit/specs/NativeBareKit' || 
        moduleName.includes('react-native-bare-kit/specs/NativeBareKit') ||
        (moduleName === './specs/NativeBareKit' && context.originModulePath && 
         context.originModulePath.includes('react-native-bare-kit'))) {
      const shimPath = path.resolve(__dirname, 'src/shims/react-native-bare-kit-specs-NativeBareKit.web.ts');
      try {
        return {
          type: 'sourceFile',
          filePath: shimPath,
        };
      } catch (e) {
        // Fall through to default resolution
      }
    }
    // Handle url module for axios on web
    if (moduleName === 'url') {
      const shimPath = path.resolve(__dirname, 'src/shims/url.web.ts');
      try {
        return {
          type: 'sourceFile',
          filePath: shimPath,
        };
      } catch (e) {
        // Fall through to default resolution
      }
    }
  }

  // Delegate to WDK's resolveRequest
  const result = wdkResolveRequest(context, moduleName, platform);
  
  // If we got a result for web and it's trying to load react-native-bare-kit/specs/NativeBareKit, override it
  if (platform === 'web' && result && result.type === 'sourceFile') {
    const filePath = result.filePath || '';
    if (filePath.includes('react-native-bare-kit/specs/NativeBareKit')) {
      const shimPath = path.resolve(__dirname, 'src/shims/react-native-bare-kit-specs-NativeBareKit.web.ts');
      return {
        type: 'sourceFile',
        filePath: shimPath,
      };
    }
  }
  
  return result;
};

module.exports = wdkConfig;
