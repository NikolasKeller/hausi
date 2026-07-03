const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);
// Allow importing ../shared/types.ts from outside the app root.
config.watchFolders = [workspaceRoot];

module.exports = config;
