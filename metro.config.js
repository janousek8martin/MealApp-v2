const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Resolve drizzle .sql migration files.
config.resolver.sourceExts.push('sql');

// expo-sqlite's web backend (wa-sqlite) ships a .wasm binary that Metro
// doesn't treat as an asset by default.
config.resolver.assetExts.push('wasm');

// wa-sqlite's OPFS worker needs SharedArrayBuffer, which browsers only expose
// on cross-origin-isolated pages (dev-only; not needed for the Android target).
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  return middleware(req, res, next);
};

module.exports = config;
