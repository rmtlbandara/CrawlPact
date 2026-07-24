// @ts-check
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.astro/**",
      "**/.wrangler/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  js.configs.recommended,
  ...astro.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // TypeScript's own compiler (astro check / tsc) already catches
      // genuinely undefined identifiers, including ambient types
      // (D1Database, App.Locals, ExportedHandler) that no-undef cannot
      // understand — this is typescript-eslint's own documented guidance.
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettier,
];
