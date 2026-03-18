// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
