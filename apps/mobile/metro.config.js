/* global require, module, __dirname */
/* eslint @typescript-eslint/no-require-imports: off -- Metro loads this Node configuration as CommonJS. */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(workspaceRoot, 'packages/shared'),
  path.resolve(workspaceRoot, 'packages/coordinator'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  '@aurorasense/shared': path.resolve(workspaceRoot, 'packages/shared'),
  '@aurorasense/coordinator': path.resolve(workspaceRoot, 'packages/coordinator'),
};

module.exports = config;
