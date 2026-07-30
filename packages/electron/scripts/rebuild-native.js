#!/usr/bin/env node
// electron-builder's `install-app-deps` doesn't reliably find hoisted native
// modules in this npm-workspaces layout, so we rebuild directly: fetch the
// prebuilt better-sqlite3 binary for Electron's own Node ABI instead of the
// host Node ABI it was installed against.
const { execSync } = require('child_process');
const path = require('path');

const electronVersion = require('electron/package.json').version;
const betterSqlite3Dir = path.dirname(require.resolve('better-sqlite3/package.json'));

console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion}...`);
execSync(`npx prebuild-install --runtime=electron --target=${electronVersion}`, {
  cwd: betterSqlite3Dir,
  stdio: 'inherit',
});
