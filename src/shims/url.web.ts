// Web polyfill for Node.js 'url' module
// Provides URLSearchParams for axios on web platform

// URLSearchParams is available globally in browsers
// Export it in a format that matches Node.js url module exports
// axios expects: import url from 'url'; url.URLSearchParams

// Default export (what axios imports)
const urlModule = {
  URLSearchParams: globalThis.URLSearchParams,
  // Add other url module exports if needed
};

export default urlModule;

// Named export for direct access
export const URLSearchParams = globalThis.URLSearchParams;
