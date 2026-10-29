/* global require, module, __dirname */
/* eslint @typescript-eslint/no-require-imports: off -- Metro loads this Node configuration as CommonJS. */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../../packages/shared')];
config.resolver.extraNodeModules = {
  '@aurorasense/shared': path.resolve(__dirname, '../../packages/shared'),
};
module.exports = config;
