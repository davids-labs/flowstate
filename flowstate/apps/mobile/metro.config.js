const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (required for @flowstate/core)
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), monorepoRoot]));

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Override Expo's auto-detected server root.
//    Expo sets unstable_serverRoot to the nearest workspace root (monorepoRoot),
//    which makes --entry-file paths relative to the workspace root.
//    We set it to the project root so the RN Gradle Plugin's --entry-file ("index.ts")
//    resolves correctly and expo-router's require.context finds app/ routes.
config.server = {
  ...config.server,
  unstable_serverRoot: projectRoot,
};

module.exports = config;
