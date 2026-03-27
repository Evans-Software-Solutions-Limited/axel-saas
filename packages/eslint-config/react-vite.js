import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * ESLint flat config for Vite + React + TypeScript (browser app).
 *
 * @param {string} tsconfigRootDir - Pass `import.meta.dirname` from the consumer's eslint.config.js
 */
export function reactVite(tsconfigRootDir) {
  return defineConfig([
    globalIgnores(["dist", "coverage"]),
    { ignores: ["**/sst-env.d.ts"] },
    {
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
      ],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
        parserOptions: {
          tsconfigRootDir,
        },
      },
    },
    {
      files: [
        "src/components/theme-provider.tsx",
        "src/components/ui/**/*.tsx",
      ],
      rules: {
        "react-refresh/only-export-components": "off",
      },
    },
  ]);
}
