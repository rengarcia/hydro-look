// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `.next/` and `out/` are build output — `out/` is the static export, bundled and minified,
  // and linting it means linting Next's runtime rather than this repository's code.
  {
    ignores: ["node_modules/**", "data/**", "tests/fixtures/**", ".next/**", "out/**", "next-env.d.ts", ".claude/**", "coverage/**"],
  },
  js.configs.recommended,
  // Type-aware: in an async pipeline no-floating-promises and no-misused-promises are the rules
  // that matter, and they need the types (ENHANCEMENTS §6.2).
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ["**/*.js", "**/*.mjs", "**/*.cjs"], ...tseslint.configs.disableTypeChecked },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      // Every case it flags is an `unknown` CSV or JSON cell passed to String() on purpose: the
      // contracts guarantee primitives, and an object that slipped through should print as one.
      "@typescript-eslint/no-base-to-string": "off",
    },
  },
  {
    // Test doubles implement async interfaces without awaiting, and read fixtures as untyped JSON.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
);
