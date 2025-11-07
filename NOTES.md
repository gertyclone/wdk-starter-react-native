nvm use v24.11.0

// Adjust app.json to match the new name and slug and bundle identifier

// Add this to package.json

    "gen:bundle": "npm --prefix node_modules/@tetherto/pear-wrk-wdk run gen:mobile-bundle",

// Changes to src/config/assets.ts and get-chains-config.ts

// Try 
npm install --legacy-peer-deps

// Should build with warnings

// Create the .env file for INDEXER_API_KEY and TRON_API_KEY and TRON_API_SECRET

