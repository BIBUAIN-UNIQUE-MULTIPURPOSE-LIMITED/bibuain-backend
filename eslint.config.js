const typescript = require("@typescript-eslint/eslint-plugin");
const parser = require("@typescript-eslint/parser");
const sonarjs = require("eslint-plugin-sonarjs");

/** @type {import('eslint').Linter.Config} */
module.exports = [
  {
    ignores: ["dist/", "eslint.config.js", "jest.config.js"],
    languageOptions: {
      parser,
      parserOptions: {
        project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      sonarjs: sonarjs,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-redundant-boolean": "error",
      "no-else-return": "error",
    },
  },
];
