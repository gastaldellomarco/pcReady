import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "dist/**",
      ".output/**",
      ".vinxi/**",
      "coverage/**",
      ".venv/**",
      "**/.venv/**",
      "**/*.venv/**",
      "src/integrations/supabase/types.ts",
      "src/routeTree.gen.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "off",
      "linebreak-style": ["error", "unix"],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Incremental: tighten after reducing `any` in these trees (see #58).
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/routes/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
