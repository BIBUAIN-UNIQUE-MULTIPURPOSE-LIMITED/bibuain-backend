const typescript = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.Config} */
module.exports = [
  {
    languageOptions: {
      parser,
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // Optional: Add your custom rules here
    },
  },
];
