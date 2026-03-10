import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    files: ["**/*.test.ts", "**/*.tests.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
