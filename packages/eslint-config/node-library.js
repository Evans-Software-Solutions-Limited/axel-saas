import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config for Node + TypeScript libraries (packages, services).
 *
 * @param {string} tsconfigRootDir - Pass `import.meta.dirname` from the consumer's eslint.config.js
 * @param {{ relaxedTests?: boolean }} [options] - When true, relax `no-explicit-any` in `*.test.ts` / `*.tests.ts`
 */
export function nodeLibrary(tsconfigRootDir, options = {}) {
  const relaxedTests = options.relaxedTests === true;

  return tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          tsconfigRootDir,
        },
      },
    },
    ...(relaxedTests
      ? [
          {
            files: ["**/*.test.ts", "**/*.tests.ts"],
            rules: { "@typescript-eslint/no-explicit-any": "off" },
          },
        ]
      : []),
  );
}
