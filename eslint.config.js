'use strict';

const gtsConfig = require('gts/build/eslint.config.js');

module.exports = [
  {ignores: ['dist/**', 'webview-ui/**']},
  ...gtsConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
];
