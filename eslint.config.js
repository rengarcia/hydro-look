// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `.next/` and `out/` are build output — `out/` is the static export, bundled and minified,
  // and linting it means linting Next's runtime rather than this repository's code.
  { ignores: ["node_modules/**", "data/**", "tests/fixtures/**", ".next/**", "out/**", "next-env.d.ts", ".claude/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
);
