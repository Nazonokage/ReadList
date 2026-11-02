const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'dist-android/**', '.expo/**', 'src/reader/pdfRuntime.js'] },
  {
    // The Node test and helper scripts run outside the app bundle: `node:test`,
    // Buffer and the Playwright browser globals are expected here.
    files: ['tests/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2024 },
    },
    rules: {
      'no-console': 'off',
    },
  },
]);
