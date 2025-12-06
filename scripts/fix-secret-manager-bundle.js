#!/usr/bin/env node

/**
 * Post-install script to fix the secret manager bundle generation
 * This ensures sodium-native is properly configured for native addon resolution
 */

const fs = require('fs');
const path = require('path');

const providerPath = path.join(__dirname, '..', 'node_modules', '@tetherto', 'wdk-react-native-provider');
const importsFile = path.join(providerPath, 'pack.imports.json');
const packageJsonPath = path.join(providerPath, 'package.json');

if (!fs.existsSync(providerPath)) {
  console.log('@tetherto/wdk-react-native-provider not found, skipping fix');
  process.exit(0);
}

// Create pack.imports.json if it doesn't exist
const importsConfig = {
  http: 'bare-http1',
  http2: 'bare-http1',
  bufferutil: 'bufferutil',
  'utf-8-validate': 'utf-8-validate',
  'sodium-native': 'sodium-native',
};

if (!fs.existsSync(importsFile)) {
  fs.writeFileSync(importsFile, JSON.stringify(importsConfig, null, 2) + '\n');
  console.log('Created pack.imports.json for secret manager bundle');
} else {
  const existing = JSON.parse(fs.readFileSync(importsFile, 'utf8'));
  const updated = { ...existing, ...importsConfig };
  fs.writeFileSync(importsFile, JSON.stringify(updated, null, 2) + '\n');
  console.log('Updated pack.imports.json for secret manager bundle');
}

// Update package.json to include --imports flag in gen:secret-manager-bundle script
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts['gen:secret-manager-bundle']) {
    const currentScript = packageJson.scripts['gen:secret-manager-bundle'];
    
    // Check if --imports is already present
    if (!currentScript.includes('--imports')) {
      // Add --imports flag before --out
      const updatedScript = currentScript.replace(
        '--linked --out',
        '--linked --imports pack.imports.json --out'
      );
      
      packageJson.scripts['gen:secret-manager-bundle'] = updatedScript;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('Updated gen:secret-manager-bundle script to include --imports flag');
    } else {
      console.log('gen:secret-manager-bundle script already includes --imports flag');
    }
  }
}

console.log('Secret manager bundle configuration fix applied');

