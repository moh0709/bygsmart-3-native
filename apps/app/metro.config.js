// Metro config for the BygSmart 3.0 universal Expo app inside the pnpm + Turborepo
// monorepo. Metro must watch the whole workspace and resolve modules from both the
// app's own node_modules and the hoisted workspace node_modules (node-linker=hoisted).
//
// See: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
// workspaceRoot = two levels up (apps/app -> apps -> repo root).
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. With a hoisted layout, do not walk parent node_modules hierarchically —
//    only the explicit paths above. This keeps resolution deterministic.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
