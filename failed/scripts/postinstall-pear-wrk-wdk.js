#!/usr/bin/env node

/**
 * Postinstall script to fix bare-pack bundling issues in @tetherto/pear-wrk-wdk
 * 
 * This script:
 * 1. Installs bufferutil as an optional dependency (needed for ws library)
 * 2. Creates stub modules for http2, bufferutil, and utf-8-validate
 * 3. Updates pack.imports.json to map these modules correctly
 * 4. Replaces nested @wdk/wallet-btc with symlink to local version (if override is used)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PEAR_WRK_WDK_PATH = path.join(__dirname, '..', 'node_modules', '@tetherto', 'pear-wrk-wdk');

function log(message) {
  console.log(`[postinstall-pear-wrk-wdk] ${message}`);
}

function checkPearWrkWdkExists() {
  if (!fs.existsSync(PEAR_WRK_WDK_PATH)) {
    log('@tetherto/pear-wrk-wdk not found, skipping postinstall fixes');
    return false;
  }
  return true;
}

function installBufferutil() {
  try {
    log('Installing bufferutil as optional dependency...');
    execSync('npm install --save-optional bufferutil', {
      cwd: PEAR_WRK_WDK_PATH,
      stdio: 'ignore'
    });
    log('✓ bufferutil installed');
  } catch (error) {
    log('⚠ Failed to install bufferutil (non-fatal): ' + error.message);
  }
}

function createHttp2Stub() {
  const http2StubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'http2', 'index.js');
  const http2StubDir = path.dirname(http2StubPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(http2StubDir)) {
      fs.mkdirSync(http2StubDir, { recursive: true });
    }
    
    // Create stub module
    const stubContent = `// Stub module for http2 - not needed for mobile bundling
module.exports = {};
`;
    
    fs.writeFileSync(http2StubPath, stubContent, 'utf8');
    log('✓ http2 stub module created');
  } catch (error) {
    log('✗ Failed to create http2 stub: ' + error.message);
    throw error;
  }
}

function createBufferutilStub() {
  const bufferutilStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'bufferutil', 'index.js');
  const bufferutilStubDir = path.dirname(bufferutilStubPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(bufferutilStubDir)) {
      fs.mkdirSync(bufferutilStubDir, { recursive: true });
    }
    
    // Create stub module - bufferutil provides mask/unmask functions for WebSocket
    // We'll provide a stub that falls back to JavaScript implementation
    const stubContent = `// Stub module for bufferutil - optional native dependency for ws library
// The ws library will fall back to JavaScript implementation if this is not available
module.exports = {
  mask: function(source, mask, output, offset, length) {
    // Fallback to JavaScript implementation
    for (let i = 0; i < length; i++) {
      output[offset + i] = source[i] ^ mask[i & 3];
    }
  },
  unmask: function(buffer, mask) {
    // Fallback to JavaScript implementation
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] ^= mask[i & 3];
    }
  }
};
`;
    
    fs.writeFileSync(bufferutilStubPath, stubContent, 'utf8');
    log('✓ bufferutil stub module created');
  } catch (error) {
    log('✗ Failed to create bufferutil stub: ' + error.message);
    throw error;
  }
}

function createUtf8ValidateStub() {
  const utf8ValidateStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'utf-8-validate', 'index.js');
  const utf8ValidateStubDir = path.dirname(utf8ValidateStubPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(utf8ValidateStubDir)) {
      fs.mkdirSync(utf8ValidateStubDir, { recursive: true });
    }
    
    // Create stub module - utf-8-validate provides UTF-8 validation for WebSocket
    // We'll provide a stub that falls back to JavaScript implementation
    const stubContent = `// Stub module for utf-8-validate - optional native dependency for ws library
// The ws library will fall back to JavaScript implementation if this is not available
module.exports = {
  isValidUTF8: function(buffer) {
    // Fallback to JavaScript implementation - basic UTF-8 validation
    try {
      // Use TextDecoder to validate UTF-8
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(buffer);
      return true;
    } catch (e) {
      return false;
    }
  }
};
`;
    
    fs.writeFileSync(utf8ValidateStubPath, stubContent, 'utf8');
    log('✓ utf-8-validate stub module created');
  } catch (error) {
    log('✗ Failed to create utf-8-validate stub: ' + error.message);
    throw error;
  }
}

function createSodiumNativeStub() {
  const sodiumNativeStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'sodium-native', 'index.js');
  const sodiumNativeBindingStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'sodium-native', 'binding.js');
  const sodiumNativeStubDir = path.dirname(sodiumNativeStubPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(sodiumNativeStubDir)) {
      fs.mkdirSync(sodiumNativeStubDir, { recursive: true });
    }
    
    // Create stub module that re-exports from sodium-javascript
    // This allows sodium-universal to use sodium-javascript instead of sodium-native
    const stubContent = `// Stub module for sodium-native - maps to sodium-javascript for BareKit compatibility
// sodium-native requires native addons which don't work in BareKit worklets
// This stub re-exports from sodium-javascript which is JavaScript-only

try {
  // Re-export from sodium-javascript as a fallback
  module.exports = require('sodium-javascript');
} catch (e) {
  // If sodium-javascript is not available, throw a clear error
  throw new Error('sodium-native stub: sodium-javascript is required but not available. Please install sodium-javascript.');
}
`;
    
    fs.writeFileSync(sodiumNativeStubPath, stubContent, 'utf8');
    
    // Create binding.js stub that also re-exports from sodium-javascript
    // This prevents the native addon loading error when binding.js is imported
    const bindingStubContent = `// Stub for sodium-native/binding.js - prevents native addon loading in BareKit
// This file would normally load a native addon (the '.' import), but we use sodium-javascript instead
// Re-export from sodium-javascript to provide the same API

try {
  // Re-export from sodium-javascript as a fallback
  module.exports = require('sodium-javascript');
} catch (e) {
  // If sodium-javascript is not available, throw a clear error
  throw new Error('sodium-native/binding.js stub: sodium-javascript is required but not available. Please install sodium-javascript.');
}
`;
    
    fs.writeFileSync(sodiumNativeBindingStubPath, bindingStubContent, 'utf8');
    log('✓ sodium-native stub modules created (index.js and binding.js)');
  } catch (error) {
    log('✗ Failed to create sodium-native stub: ' + error.message);
    throw error;
  }
}

function patchSodiumUniversal() {
  // Find sodium-universal in node_modules (could be in multiple locations)
  const possiblePaths = [
    path.join(__dirname, '..', 'node_modules', 'sodium-universal', 'index.js'),
    path.join(PEAR_WRK_WDK_PATH, 'node_modules', 'sodium-universal', 'index.js'),
  ];
  
  for (const sodiumUniversalPath of possiblePaths) {
    if (fs.existsSync(sodiumUniversalPath)) {
      try {
        // Patch sodium-universal to try sodium-javascript if sodium-native fails
        const patchedContent = `// Patched for BareKit compatibility
// Try sodium-native first, fall back to sodium-javascript if it fails

let sodium;
try {
  sodium = require('sodium-native');
} catch (e) {
  // sodium-native failed (likely in BareKit), try sodium-javascript
  try {
    sodium = require('sodium-javascript');
  } catch (e2) {
    throw new Error('Neither sodium-native nor sodium-javascript is available: ' + e2.message);
  }
}

module.exports = sodium;
`;
        
        fs.writeFileSync(sodiumUniversalPath, patchedContent, 'utf8');
        log(`✓ Patched sodium-universal at ${sodiumUniversalPath}`);
        return; // Only patch the first one found
      } catch (error) {
        log(`⚠ Failed to patch sodium-universal at ${sodiumUniversalPath}: ${error.message}`);
      }
    }
  }
  
  log('⚠ sodium-universal not found, skipping patch');
}

function createWorkerStub() {
  const workerStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'worker', 'index.js');
  const workerStubDir = path.dirname(workerStubPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(workerStubDir)) {
      fs.mkdirSync(workerStubDir, { recursive: true });
    }
    
    // Create stub module for worker (used by sodium-javascript but not available in BareKit)
    const stubContent = `// Stub module for worker - used by sodium-javascript but not available in BareKit
// This is a minimal stub that provides the Worker API expected by sodium-javascript
// In BareKit, we don't actually need workers, so this is a no-op implementation

class Worker {
  constructor(url) {
    // Stub implementation - workers not supported in BareKit
    this.url = url;
  }
  
  postMessage(message) {
    // No-op
  }
  
  terminate() {
    // No-op
  }
  
  addEventListener(event, handler) {
    // No-op
  }
  
  removeEventListener(event, handler) {
    // No-op
  }
}

module.exports = Worker;
`;
    
    fs.writeFileSync(workerStubPath, stubContent, 'utf8');
    log('✓ worker stub module created');
  } catch (error) {
    log('✗ Failed to create worker stub: ' + error.message);
    throw error;
  }
}

function createCryStub() {
  const cryStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'cry', 'index.js');
  const cryStubDir = path.dirname(cryStubPath);
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(cryStubDir)) {
      fs.mkdirSync(cryStubDir, { recursive: true });
    }
    
    // Create stub module for cry (used by sodium-javascript but not available in BareKit)
    const stubContent = `// Stub module for cry - used by sodium-javascript but not available in BareKit
// cry is a crypto library, but we'll use a minimal stub since crypto is available in BareKit

module.exports = {
  // Minimal stub - crypto functions should be available via global crypto in BareKit
  // If sodium-javascript needs specific functions, they can be implemented here
};
`;
    
    fs.writeFileSync(cryStubPath, stubContent, 'utf8');
    log('✓ cry stub module created');
  } catch (error) {
    log('✗ Failed to create cry stub: ' + error.message);
    throw error;
  }
}

function updatePackImports() {
  const packImportsPath = path.join(PEAR_WRK_WDK_PATH, 'pack.imports.json');
  
  try {
    let packImports = {};
    
    // Read existing pack.imports.json if it exists
    if (fs.existsSync(packImportsPath)) {
      const content = fs.readFileSync(packImportsPath, 'utf8');
      packImports = JSON.parse(content);
    }
    
    // Get absolute paths to stubs
    const http2StubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'http2', 'index.js');
    const http2StubUrl = `file://${http2StubPath}`;
    
    const bufferutilStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'bufferutil', 'index.js');
    const bufferutilStubUrl = `file://${bufferutilStubPath}`;
    
    const utf8ValidateStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'utf-8-validate', 'index.js');
    const utf8ValidateStubUrl = `file://${utf8ValidateStubPath}`;
    
    const sodiumNativeStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'sodium-native', 'index.js');
    const sodiumNativeStubUrl = `file://${sodiumNativeStubPath}`;
    const sodiumNativeBindingStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'sodium-native', 'binding.js');
    const sodiumNativeBindingStubUrl = `file://${sodiumNativeBindingStubPath}`;
    
    const workerStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'worker', 'index.js');
    const workerStubUrl = `file://${workerStubPath}`;
    
    const cryStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'cry', 'index.js');
    const cryStubUrl = `file://${cryStubPath}`;
    
    // Update pack.imports.json
    packImports.http = packImports.http || 'bare-http1';
    packImports.http2 = http2StubUrl;
    packImports.bufferutil = bufferutilStubUrl;
    packImports['utf-8-validate'] = utf8ValidateStubUrl;
    // Map sodium-native to stub that uses sodium-javascript for BareKit compatibility
    // sodium-native requires native addons which don't work in BareKit worklets
    packImports['sodium-native'] = sodiumNativeStubUrl;
    // Also map sodium-native/binding.js to prevent native addon loading errors
    // The binding.js file tries to load a native addon (the '.' import) which fails in BareKit
    packImports['sodium-native/binding.js'] = sodiumNativeBindingStubUrl;
    // Map worker to stub (required by sodium-javascript but not available in BareKit)
    packImports['worker'] = workerStubUrl;
    // Map cry to stub (required by sodium-javascript but not available in BareKit)
    packImports['cry'] = cryStubUrl;
    
    fs.writeFileSync(packImportsPath, JSON.stringify(packImports, null, 2) + '\n', 'utf8');
    log('✓ pack.imports.json updated');
  } catch (error) {
    log('✗ Failed to update pack.imports.json: ' + error.message);
    throw error;
  }
}

function replaceSodiumNative(sodiumNativePath, location) {
  const sodiumNativeStubPath = path.join(PEAR_WRK_WDK_PATH, 'shims', 'sodium-native', 'index.js');
  
  try {
    // Check if sodium-native exists
    if (!fs.existsSync(sodiumNativePath)) {
      return; // No copy, nothing to do
    }
    
    // Check if stub exists
    if (!fs.existsSync(sodiumNativeStubPath)) {
      log(`⚠ sodium-native stub not found, skipping replacement for ${location}`);
      return;
    }
    
    // Remove sodium-native and replace with stub
    if (fs.existsSync(sodiumNativePath)) {
      const stats = fs.lstatSync(sodiumNativePath);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(sodiumNativePath);
      } else {
        fs.rmSync(sodiumNativePath, { recursive: true, force: true });
      }
    }
    
    // Create the directory and write stubs for both index.js and binding.js
    fs.mkdirSync(sodiumNativePath, { recursive: true });
    
    // Stub for index.js - re-exports from sodium-javascript
    const indexStubContent = `// Stub module for sodium-native - maps to sodium-javascript for BareKit compatibility
// sodium-native requires native addons which don't work in BareKit worklets
// This stub re-exports from sodium-javascript which is JavaScript-only

try {
  // Re-export from sodium-javascript as a fallback
  module.exports = require('sodium-javascript');
} catch (e) {
  // If sodium-javascript is not available, throw a clear error
  throw new Error('sodium-native stub: sodium-javascript is required but not available. Please install sodium-javascript.');
}
`;
    fs.writeFileSync(path.join(sodiumNativePath, 'index.js'), indexStubContent, 'utf8');
    
    // Stub for binding.js - prevents native addon loading
    const bindingStubContent = `// Stub for sodium-native/binding.js - prevents native addon loading in BareKit
// This file would normally load a native addon, but we use sodium-javascript instead
throw new Error('sodium-native native addon is not available in BareKit worklets. Use sodium-javascript instead.');
`;
    fs.writeFileSync(path.join(sodiumNativePath, 'binding.js'), bindingStubContent, 'utf8');
    
    log(`✓ Replaced ${location} sodium-native with stub`);
  } catch (error) {
    log(`⚠ Failed to replace ${location} sodium-native (non-fatal): ${error.message}`);
  }
}

function replaceNestedSodiumNative() {
  const nestedSodiumNativePath = path.join(PEAR_WRK_WDK_PATH, 'node_modules', 'sodium-native');
  replaceSodiumNative(nestedSodiumNativePath, 'nested');
}

function replaceTopLevelSodiumNative() {
  const topLevelSodiumNativePath = path.join(__dirname, '..', 'node_modules', 'sodium-native');
  replaceSodiumNative(topLevelSodiumNativePath, 'top-level');
}

function linkLocalWalletBtc() {
  const nestedWalletBtcPath = path.join(PEAR_WRK_WDK_PATH, 'node_modules', '@wdk', 'wallet-btc');
  const topLevelWalletBtcPath = path.join(__dirname, '..', 'node_modules', '@wdk', 'wallet-btc');
  const localWalletBtcPath = path.join(__dirname, '..', '..', 'wdk-wallet-btc');
  
  try {
    // Check if nested copy exists
    if (!fs.existsSync(nestedWalletBtcPath)) {
      return; // No nested copy, nothing to do
    }
    
    // Check if top-level symlink exists (indicating override is active)
    if (!fs.existsSync(topLevelWalletBtcPath)) {
      return; // Override not active, skip
    }
    
    // Check if local directory exists
    if (!fs.existsSync(localWalletBtcPath)) {
      log('⚠ Local wdk-wallet-btc directory not found, skipping symlink creation');
      return;
    }
    
    // Remove the nested copy
    if (fs.existsSync(nestedWalletBtcPath)) {
      const stats = fs.lstatSync(nestedWalletBtcPath);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(nestedWalletBtcPath);
      } else {
        fs.rmSync(nestedWalletBtcPath, { recursive: true, force: true });
      }
    }
    
    // Create parent directory if it doesn't exist
    const nestedWalletBtcDir = path.dirname(nestedWalletBtcPath);
    if (!fs.existsSync(nestedWalletBtcDir)) {
      fs.mkdirSync(nestedWalletBtcDir, { recursive: true });
    }
    const nestedWalletBtcParentDir = path.dirname(nestedWalletBtcDir);
    if (!fs.existsSync(nestedWalletBtcParentDir)) {
      fs.mkdirSync(nestedWalletBtcParentDir, { recursive: true });
    }
    
    // Create symlink to local version
    // Calculate relative path from nested location's parent directory to local directory
    const relativePath = path.relative(nestedWalletBtcDir, localWalletBtcPath);
    fs.symlinkSync(relativePath, nestedWalletBtcPath, 'dir');
    log('✓ Replaced nested @wdk/wallet-btc with symlink to local version');
  } catch (error) {
    log('⚠ Failed to link local wallet-btc (non-fatal): ' + error.message);
    // Non-fatal - continue execution
  }
}

// Main execution
try {
  if (!checkPearWrkWdkExists()) {
    process.exit(0);
  }
  
  log('Applying fixes to @tetherto/pear-wrk-wdk...');
      installBufferutil();
      createHttp2Stub();
      createBufferutilStub();
      createUtf8ValidateStub();
      createSodiumNativeStub();
      createWorkerStub();
      createCryStub();
      patchSodiumUniversal();
      replaceNestedSodiumNative();
      replaceTopLevelSodiumNative();
      updatePackImports();
      linkLocalWalletBtc();
  log('✓ All fixes applied successfully');
} catch (error) {
  log('✗ Postinstall script failed: ' + error.message);
  process.exit(1);
}

