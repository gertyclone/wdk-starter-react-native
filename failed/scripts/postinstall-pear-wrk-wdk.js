#!/usr/bin/env node

/**
 * Postinstall script to fix bare-pack bundling issues in @tetherto/pear-wrk-wdk
 * 
 * This script:
 * 1. Installs bufferutil as an optional dependency (needed for ws library)
 * 2. Creates stub modules for http2, bufferutil, and utf-8-validate
 * 3. Updates pack.imports.json to map these modules correctly
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
    
    // Update pack.imports.json
    packImports.http = packImports.http || 'bare-http1';
    packImports.http2 = http2StubUrl;
    packImports.bufferutil = bufferutilStubUrl;
    packImports['utf-8-validate'] = utf8ValidateStubUrl;
    
    fs.writeFileSync(packImportsPath, JSON.stringify(packImports, null, 2) + '\n', 'utf8');
    log('✓ pack.imports.json updated');
  } catch (error) {
    log('✗ Failed to update pack.imports.json: ' + error.message);
    throw error;
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
  updatePackImports();
  log('✓ All fixes applied successfully');
} catch (error) {
  log('✗ Postinstall script failed: ' + error.message);
  process.exit(1);
}

